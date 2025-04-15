import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import GroupSearch from '../components/GroupSearch'

const GroupsList = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState({ interestBased: [], custom: [] })
  const [userGroups, setUserGroups] = useState([])
  const [error, setError] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [deletingGroup, setDeletingGroup] = useState(null)
  const [deleteError, setDeleteError] = useState(null)
  const [activeTab, setActiveTab] = useState('all') // 'all', 'interest', 'custom'

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
            members:group_members(count),
            is_interest_based
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

        // Format and separate the groups data
        const formattedGroups = groupsData.map(group => ({
          ...group,
          memberCount: group.members[0].count,
          creatorName: group.created_by && creatorProfiles[group.created_by] 
            ? creatorProfiles[group.created_by].username 
            : 'Unknown',
          isUserMember: userGroupIds.includes(group.id)
        }))

        // Separate groups by type
        setGroups({
          interestBased: formattedGroups.filter(g => g.is_interest_based === true),
          custom: formattedGroups.filter(g => g.is_interest_based === false)
        })
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
      setGroups(prevGroups => ({
        ...prevGroups,
        interestBased: prevGroups.interestBased.filter(g => g.id !== groupId),
        custom: prevGroups.custom.filter(g => g.id !== groupId)
      }));
      
    } catch (error) {
      console.error('Error in delete process:', error);
      setDeleteError(`Failed to delete group: ${error.message}`);
    } finally {
      setDeletingGroup(null);
    }
  };

  const renderGroupCard = (group) => (
    <div key={group.id} className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-semibold text-gray-800">{group.name}</h3>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          group.isUserMember ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {group.isUserMember ? 'Member' : `${group.memberCount} members`}
        </span>
      </div>
      <p className="text-gray-600 text-sm mb-3 line-clamp-2">{group.description || 'No description'}</p>
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-500">Created by {group.creatorName}</span>
        {!group.isUserMember && (
          <button
            onClick={() => navigate(`/join-group/${group.id}`)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1 rounded-md text-sm transition-colors"
          >
            Join Group
          </button>
        )}
      </div>
    </div>
  )

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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Custom Groups</h1>
          <div className="space-x-3">
            <button
              onClick={() => navigate('/puzzles')}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md transition-colors"
            >
              Find Interest Match
            </button>
            <button
              onClick={() => navigate('/create-group')}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors"
            >
              Create Group
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {groups.custom.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No custom groups available</h3>
            <p className="text-gray-500">
              Create your own group or find an interest match in the Puzzles section!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.custom.map(renderGroupCard)}
          </div>
        )}
      </div>
    </Layout>
  )
}

export default GroupsList 