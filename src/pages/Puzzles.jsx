import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import InterestSelector from '../components/InterestSelector'
import { getAllOptions } from '../lib/staticTags'

const Puzzles = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [userInterests, setUserInterests] = useState([])
  const [step, setStep] = useState('tags') // 'tags' or 'confirm'
  
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true)
        
        // Get the authenticated user
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError) {
          console.error('User auth error:', userError)
          throw userError
        }
        
        if (!user) {
          navigate('/login')
          return
        }
        
        setCurrentUser(user)
        
        // Get any existing user tags
        const { data: userTags, error: interestsError } = await supabase
          .from('user_static_tags')
          .select('tag_id')
          .eq('user_id', user.id)
        
        if (interestsError) {
          console.error('Error fetching user tags:', interestsError)
        } else if (userTags && userTags.length > 0) {
          // Extract just the tag IDs
          setUserInterests(userTags.map(tag => tag.tag_id))
        }
      } catch (error) {
        console.error('Error fetching user data:', error)
        setError('Error loading user data. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    
    fetchUserData()
  }, [navigate])

  const handleInterestsSave = async (selectedInterests) => {
    if (!currentUser) {
      setError('You must be logged in to save interests')
      return
    }
    
    if (selectedInterests.length === 0) {
      setError('Please select at least one interest')
      return
    }
    
    setUserInterests(selectedInterests)
    setStep('confirm')
  }
  
  const resetSelections = () => {
    setUserInterests([])
    setStep('tags')
  }
  
  const handleSubmit = async () => {
    if (!currentUser || userInterests.length === 0) {
      setError('Please select your interests first')
      return
    }
    
    setSubmitting(true)
    setError(null)
    
    try {
      console.log('Submitting interests:', userInterests)
      
      // First delete existing tags
      const { error: deleteError } = await supabase
        .from('user_static_tags')
        .delete()
        .eq('user_id', currentUser.id)
        
      if (deleteError) {
        console.error('Error deleting existing tags:', deleteError)
        // Continue anyway - the insert will handle conflicts
      }
      
      // Insert new tags
      const tagsToInsert = userInterests.map(tagId => ({
        user_id: currentUser.id,
        tag_id: tagId
      }))
      
      console.log('Inserting user tags:', tagsToInsert)
      const { error: insertError } = await supabase
        .from('user_static_tags')
        .insert(tagsToInsert)
        .select()
      
      if (insertError) {
        console.error('Error inserting tags:', insertError)
        throw new Error(`Failed to save your interests: ${insertError.message}`)
      }
      
      console.log('Tags inserted, calling create_static_tag_group with params:', {
        user_uuid: currentUser.id,
        min_tag_matches: 1,
        max_group_size: 6
      })
      
      // Create a new group based on static tags
      const { data: groupId, error: groupError } = await supabase
        .rpc('create_static_tag_group', { 
          user_uuid: currentUser.id,
          min_tag_matches: 1,
          max_group_size: 6
        })
      
      if (groupError) {
        console.error('Group matching error:', groupError)
        
        if (groupError.message && groupError.message.includes('row-level security policy')) {
          console.log('RLS policy error - using fallback method')
          const fallbackGroupId = await createFallbackGroup(currentUser.id)
          if (fallbackGroupId) {
            console.log('Created fallback group due to RLS issue, navigating to chat:', fallbackGroupId)
            resetSelections() // Reset selections after successful group creation
            navigate(`/chat/${fallbackGroupId}`)
            return
          }
        }
        
        if (groupError.message && groupError.message.includes('ambiguous')) {
          console.error('Ambiguous column error detected')
        }
        
        setError(`Group matching error: ${groupError.message}`)
        
        // Fall back to creating a new group if matching fails
        const fallbackGroupId = await createFallbackGroup(currentUser.id)
        if (fallbackGroupId) {
          console.log('Created fallback group, navigating to chat:', fallbackGroupId)
          resetSelections() // Reset selections after successful group creation
          navigate(`/chat/${fallbackGroupId}`)
        } else {
          throw new Error('Failed to create fallback group')
        }
        return
      }
      
      if (groupId) {
        console.log('Group assigned, navigating to chat:', groupId)
        resetSelections() // Reset selections after successful group creation
        navigate(`/chat/${groupId}`)
      } else {
        console.log('No group assigned, creating fallback group')
        const fallbackGroupId = await createFallbackGroup(currentUser.id)
        if (fallbackGroupId) {
          resetSelections() // Reset selections after successful group creation
          navigate(`/chat/${fallbackGroupId}`)
        } else {
          throw new Error('Failed to create fallback group')
        }
      }
    } catch (error) {
      console.error('Error submitting interests:', error)
      setError(error.message || 'An error occurred while submitting your interests. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }
  
  // Helper function to create a fallback group when matching fails
  const createFallbackGroup = async (userId) => {
    console.log('Attempting to create a new group as fallback')
    try {
      const groupName = `Interest Group ${new Date().toLocaleDateString()}`
      console.log('Creating group with name:', groupName)
      
      // Create a new group
      const { data: newGroup, error: newGroupError } = await supabase
        .from('groups')
        .insert({
          name: groupName,
          description: 'Group created based on your interests',
          created_by: userId,
          min_correct_answers: 1,
          total_questions: 2,
          is_active: true,
          last_message_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (newGroupError) {
        console.error('Error creating new group:', newGroupError)
        throw newGroupError
      }
      
      if (!newGroup) {
        console.error('No group data returned after creation')
        throw new Error('Failed to create group - no data returned')
      }
      
      console.log('Successfully created group:', newGroup.id)
      
      // Add user to the group (must be done before adding tags to satisfy RLS)
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: newGroup.id,
          user_id: userId,
          is_admin: true,
          joined_by_quiz: true
        })
      
      if (memberError) {
        console.error('Error adding user to group:', memberError)
        throw memberError
      }
      
      console.log('Successfully added user to group')
      
      // Try to find other users with similar interests
      if (userInterests.length > 0) {
        console.log('Finding other users with similar interests')
        const { data: otherUsers, error: otherUsersError } = await supabase
          .from('user_static_tags')
          .select('user_id')
          .in('tag_id', userInterests)
          .neq('user_id', userId)
          .limit(5)
          .distinct()
        
        if (!otherUsersError && otherUsers && otherUsers.length > 0) {
          console.log('Found other users with similar interests:', otherUsers.length)
          
          // Add these users to the group
          const usersToAdd = otherUsers.slice(0, 5).map(user => ({
            group_id: newGroup.id,
            user_id: user.user_id,
            is_admin: false,
            joined_by_quiz: true
          }))
          
          const { error: addUsersError } = await supabase
            .from('group_members')
            .insert(usersToAdd)
          
          if (addUsersError) {
            console.error('Error adding other users to group:', addUsersError)
            // Continue anyway - not critical
          } else {
            console.log('Added other users to group')
          }
        }
      }
      
      // Now try to add the user's tags to the group
      if (userInterests.length > 0) {
        const tagsToInsert = userInterests.map(tagId => ({
          group_id: newGroup.id,
          tag_id: tagId
        }))
        
        const { error: tagError } = await supabase
          .from('group_tags')
          .insert(tagsToInsert)
        
        if (tagError) {
          console.error('Error adding tags to group:', tagError)
          // Continue anyway - this isn't critical
        } else {
          console.log('Added user tags to group')
        }
      }
      
      // Create default questions for the group
      const defaultQuestions = [
        {
          group_id: newGroup.id,
          question: 'Do you want to join this group?',
          options: JSON.stringify(['Yes, I do', 'No, I don\'t', 'Maybe later', 'I\'m not sure']),
          correct_answer: 0,
          is_active: true
        },
        {
          group_id: newGroup.id,
          question: 'What are you interested in discussing in this group?',
          options: JSON.stringify(['General topics', 'Specific interests', 'Meeting new people', 'Learning together']),
          correct_answer: 0,
          is_active: true
        }
      ]
      
      const { error: questionsError } = await supabase
        .from('group_puzzles')
        .insert(defaultQuestions)
      
      if (questionsError) {
        console.error('Error adding default questions:', questionsError)
        // Continue anyway - not critical for group functionality
      } else {
        console.log('Successfully saved default questions')
      }
      
      console.log('Successfully created fallback group:', newGroup.id)
      return newGroup.id
    } catch (fallbackError) {
      console.error('Failed to create fallback group:', fallbackError)
      setError('Unable to create a group. Please try again later.')
      return null
    }
  }
  
  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </Layout>
    )
  }
  
  if (error && step === 'tags' && !currentUser) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 p-4 rounded-md">
            <p className="text-red-700">{error}</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Return to Home
          </button>
        </div>
      </Layout>
    )
  }
  
  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 p-4 rounded-md mb-6">
            <p className="text-red-700">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="text-sm text-red-600 hover:text-red-800 mt-2"
            >
              Dismiss
            </button>
          </div>
        )}
        
        {step === 'tags' && (
          <div>
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <h1 className="text-2xl font-bold mb-3">Find Your Group</h1>
              <p className="text-gray-600 mb-4">
                Select your interests to be matched with like-minded people. We'll create a group chat with people who share similar interests.
              </p>
            </div>
            
            <InterestSelector 
              initialInterests={userInterests} 
              onSave={handleInterestsSave} 
            />
          </div>
        )}
        
        {step === 'confirm' && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h1 className="text-2xl font-bold mb-3">Confirm Your Interests</h1>
            
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">You selected {userInterests.length} interests:</h2>
              <div className="flex flex-wrap gap-2">
                {userInterests.map(tagId => {
                  const allOptions = getAllOptions();
                  const option = allOptions.find(opt => opt.id === tagId);
                  return option ? (
                    <span key={tagId} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                      {option.name}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
            
            <div className="flex justify-between">
              <button
                onClick={() => setStep('tags')}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Edit Interests
              </button>
              
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
              >
                {submitting ? 'Finding your group...' : 'Find My Group'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default Puzzles 