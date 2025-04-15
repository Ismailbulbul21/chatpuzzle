import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import GroupSearch from '../components/GroupSearch'

const GroupsList = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState([])
  const [userGroups, setUserGroups] = useState([])
  const [error, setError] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [deletingGroup, setDeletingGroup] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          navigate('/login')
          return
        }
        
        setCurrentUser(user)
        console.log('Current user:', user.id)

        // Fetch groups the user is already a member of
        const { data: memberData, error: memberError } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('user_id', user.id)

        if (memberError) throw memberError
        console.log('User is a member of groups:', memberData)

        const userGroupIds = memberData.map(item => item.group_id)
        setUserGroups(userGroupIds)

        // Fetch all public groups
        const { data: groupsData, error: groupsError } = await supabase
          .from('groups')
          .select(`
            id,
            name,
            description,
            created_at,
            min_correct_answers,
            total_questions,
            created_by,
            members:group_members(count)
          `)
          .order('created_at', { ascending: false })

        if (groupsError) throw groupsError
        console.log('All groups:', groupsData)

        // Now, let's get the profile info for each creator
        const creatorIds = groupsData
          .filter(group => group.created_by)
          .map(group => group.created_by)
        
        let creatorProfiles = {}
        if (creatorIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, username')
            .in('id', creatorIds)
          
          creatorProfiles = profilesData.reduce((acc, profile) => {
            acc[profile.id] = profile
            return acc
          }, {})
        }

        // Format the groups data
        const formattedGroups = groupsData.map(group => ({
          ...group,
          memberCount: group.members[0].count,
          creatorName: group.created_by && creatorProfiles[group.created_by] 
            ? creatorProfiles[group.created_by].username 
            : 'Unknown',
          isUserMember: userGroupIds.includes(group.id)
        }))

        setGroups(formattedGroups)
      } catch (error) {
        console.error('Error fetching groups:', error)
        setError('An error occurred while loading groups')
      } finally {
        setLoading(false)
      }
    }

    fetchGroups()
  }, [navigate])

  // Add a function to completely delete a group
  const handleDeleteGroup = async (groupId, groupName) => {
    if (!confirm(`Are you sure you want to delete the group "${groupName}"?`)) {
      return;
    }
    
    setDeletingGroup(groupId);
    setDeleteError(null);
    
    try {
      console.log(`Deleting group ${groupId} completely from the system...`);
      
      // First delete all call sessions and participants
      const { error: callError } = await supabase
        .from('call_sessions')
        .delete()
        .eq('group_id', groupId);
        
      if (callError) {
        console.error('Error deleting call sessions:', callError);
        // Continue with other deletions
      }
      
      // Delete all answers to questions first (due to foreign key constraint)
      const { error: answersError } = await supabase
        .from('group_puzzle_answers')
        .delete()
        .eq('group_id', groupId);
        
      if (answersError) {
        console.error('Error deleting group answers:', answersError);
        throw new Error(`Failed to delete group answers: ${answersError.message}`);
      }
      
      // Then delete the questions
      const { error: questionsError } = await supabase
        .from('group_puzzles')
        .delete()
        .eq('group_id', groupId);
        
      if (questionsError) {
        console.error('Error deleting group questions:', questionsError);
        throw new Error(`Failed to delete group questions: ${questionsError.message}`);
      }
      
      // Delete all messages
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('group_id', groupId);
        
      if (messagesError) {
        console.error('Error deleting group messages:', messagesError);
      }
      
      // Delete all members
      const { error: membersError } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId);
        
      if (membersError) {
        console.error('Error deleting group members:', membersError);
        throw new Error(`Failed to delete group members: ${membersError.message}`);
      }
      
      // Finally delete the group itself
      const { error: groupError } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId);
        
      if (groupError) {
        console.error('Error deleting group:', groupError);
        throw new Error(`Failed to delete group: ${groupError.message}`);
      }
      
      // Reload groups after successful deletion
      console.log(`Group ${groupId} deleted successfully`);
      
      // Update the UI by filtering out the deleted group
      setGroups(prevGroups => prevGroups.filter(g => g.id !== groupId));
      
    } catch (error) {
      console.error('Error in delete process:', error);
      setDeleteError(`Failed to delete group: ${error.message}`);
    } finally {
      setDeletingGroup(null);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">Your Groups</h1>
            <Link
              to="/create-group"
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md"
            >
              Create New Group
            </Link>
          </div>
          
          {/* Joined Groups section */}
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="bg-red-100 p-4 rounded-md text-red-700 mb-4">
              {error}
            </div>
          ) : groups.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <h2 className="text-xl font-medium text-gray-700 mb-2">No Groups Yet</h2>
              <p className="text-gray-500 mb-4">
                You haven't joined any groups yet. Create a new group or find one to join!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map(group => (
                <div key={group.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                  <div className="p-5">
                    <h2 className="text-xl font-bold mb-2 truncate">{group.name}</h2>
                    <p className="text-gray-600 mb-4 line-clamp-2">
                      {group.description || 'No description provided'}
                    </p>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">
                        {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                      </span>
                      <button
                        onClick={() => navigate(`/chat/${group.id}`)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                      >
                        Open Chat
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Group Search Section */}
        <div className="mt-12">
          <h2 className="text-xl font-bold mb-4">Find New Groups</h2>
          <GroupSearch />
        </div>
      </div>
    </Layout>
  )
}

export default GroupsList 