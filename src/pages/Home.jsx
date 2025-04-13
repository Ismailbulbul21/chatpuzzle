import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const Home = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState([])
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDescription, setNewGroupDescription] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    const fetchUserAndGroups = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          navigate('/login')
          return
        }
        
        setUser(user)
        
        // Fetch user's groups using the user_groups view
        const { data: userGroups, error: groupsError } = await supabase
          .from('user_groups')
          .select('*')
          .eq('user_id', user.id)
          .order('last_message_at', { ascending: false });
        
        if (groupsError) throw groupsError;
        
        if (userGroups && userGroups.length > 0) {
          // Transform the data to match the expected format
          const formattedGroups = userGroups.map(group => ({
            id: group.group_id,
            name: group.name,
            description: group.description,
            created_at: group.created_at,
            updated_at: group.updated_at,
            is_active: group.is_active,
            last_message_at: group.last_message_at,
            created_by: group.created_by,
            is_admin: group.is_admin
          }));
          
          setGroups(formattedGroups);
        } else {
          setGroups([]);
        }
      } catch (error) {
        console.error('Error fetching user and groups:', error)
        setError('Error loading your groups. Please try again later.')
      } finally {
        setLoading(false)
      }
    }
    
    fetchUserAndGroups()
  }, [navigate])
  
  const handleCreateGroup = async (e) => {
    e.preventDefault()
    
    if (!newGroupName.trim()) return
    
    setCreatingGroup(true)
    
    try {
      // Create the group
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: newGroupName.trim(),
          description: newGroupDescription.trim(),
          created_by: user.id,
          last_message_at: new Date().toISOString(),
          is_active: true
        })
        .select()
        .single()
      
      if (groupError) throw groupError
      
      // Add the user as a member and admin
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: groupData.id,
          user_id: user.id,
          is_admin: true
        })
      
      if (memberError) throw memberError
      
      // Reset form and update UI
      setNewGroupName('')
      setNewGroupDescription('')
      setShowCreateForm(false)
      
      // Add the new group to the list
      setGroups(prev => [{
        ...groupData,
        is_admin: true
      }, ...prev])
      
      // Navigate to the new group
      navigate(`/chat/${groupData.id}`)
    } catch (error) {
      console.error('Error creating group:', error)
      setError('Error creating the group. Please try again.')
    } finally {
      setCreatingGroup(false)
    }
  }
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('so-SO', { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays === 1) {
      return 'Shalay'
    } else if (diffDays < 7) {
      const days = ['Axad', 'Isniin', 'Talaado', 'Arbaco', 'Khamiis', 'Jimce', 'Sabti']
      return days[date.getDay()]
    } else {
      return date.toLocaleDateString('so-SO')
    }
  }
  
  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </Layout>
    )
  }
  
  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Kooxahaaga</h1>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Koox Cusub
          </button>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p>{error}</p>
          </div>
        )}
        
        {showCreateForm && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <h2 className="text-lg font-semibold mb-4">Abuur Koox Cusub</h2>
            <form onSubmit={handleCreateGroup}>
              <div className="mb-4">
                <label htmlFor="groupName" className="block text-sm font-medium text-gray-700 mb-1">
                  Magaca Kooxda
                </label>
                <input
                  type="text"
                  id="groupName"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label htmlFor="groupDescription" className="block text-sm font-medium text-gray-700 mb-1">
                  Sharaxaad
                </label>
                <textarea
                  id="groupDescription"
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                  className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                  rows="3"
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Ka noqo
                </button>
                <button
                  type="submit"
                  disabled={creatingGroup || !newGroupName.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50"
                >
                  {creatingGroup ? 'La abuurayaa...' : 'Abuur Kooxda'}
                </button>
              </div>
            </form>
          </div>
        )}
        
        {groups.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
            </svg>
            <h2 className="text-xl font-semibold mb-2">Wax koox ah kuma jirtid weli</h2>
            <p className="text-gray-600 mb-4">
              Waxaad ku bilaabi kartaa kulan abuurista koox cusub ama ku biir mid jira.
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Abuur Koox Cusub
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((group) => (
              <Link
                key={group.id}
                to={`/chat/${group.id}`}
                className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition duration-200"
              >
                <div className="flex items-start justify-between">
                  <h2 className="text-lg font-semibold truncate">{group.name}</h2>
                  {group.is_admin && (
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                      Admin
                    </span>
                  )}
                </div>
                
                {group.description && (
                  <p className="text-gray-600 mt-2 text-sm line-clamp-2">{group.description}</p>
                )}
                
                <div className="mt-4 text-xs text-gray-500">
                  <div className="flex justify-between">
                    <span>Wakhti u dambeeyay: {formatDate(group.last_message_at)}</span>
                    <span>La sameeyay: {formatDate(group.created_at)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

export default Home 