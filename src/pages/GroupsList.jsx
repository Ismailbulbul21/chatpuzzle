import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const GroupsList = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState([])
  const [userGroups, setUserGroups] = useState([])
  const [error, setError] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)

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

        // Fetch groups the user is already a member of
        const { data: memberData, error: memberError } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('user_id', user.id)

        if (memberError) throw memberError

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
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Groups</h1>
          <button
            onClick={() => navigate('/create-group')}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Create New Group
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
            {error}
          </div>
        )}

        {userGroups.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Your Groups</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groups
                .filter(group => group.isUserMember)
                .map(group => (
                  <div key={group.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                    <div className="p-6">
                      <h3 className="text-lg font-semibold mb-2">{group.name}</h3>
                      <p className="text-gray-600 mb-4 line-clamp-2">{group.description}</p>
                      <div className="flex justify-between text-sm text-gray-500 mb-4">
                        <span>{group.memberCount} members</span>
                        <span>Created by: {group.creatorName}</span>
                      </div>
                      <button
                        onClick={() => navigate(`/chat/${group.id}`)}
                        className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        Open Chat
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-xl font-semibold mb-4">Discover Groups</h2>
          {groups.filter(group => !group.isUserMember).length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <p className="text-gray-600">No groups available to join at the moment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groups
                .filter(group => !group.isUserMember)
                .map(group => (
                  <div key={group.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                    <div className="p-6">
                      <h3 className="text-lg font-semibold mb-2">{group.name}</h3>
                      <p className="text-gray-600 mb-4 line-clamp-2">{group.description}</p>
                      <div className="flex justify-between text-sm text-gray-500 mb-4">
                        <span>{group.memberCount} members</span>
                        <span>Created by: {group.creatorName}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-500 mb-4">
                        <span>Quiz: {group.min_correct_answers}/{group.total_questions}</span>
                      </div>
                      <button
                        onClick={() => navigate(`/join-group/${group.id}`)}
                        className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                      >
                        Take Quiz to Join
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

export default GroupsList 