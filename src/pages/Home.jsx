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
          <div className="flex space-x-3">
            <button
              onClick={() => navigate('/groups')}
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 9a2 2 0 114 0 2 2 0 01-4 0z" />
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a4 4 0 00-3.446 6.032l-2.261 2.26a1 1 0 101.414 1.415l2.261-2.261A4 4 0 1011 5z" clipRule="evenodd" />
              </svg>
              Radi Kooxo
            </button>
            <button
              onClick={() => navigate('/create-group')}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Koox Cusub
            </button>
          </div>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p>{error}</p>
          </div>
        )}
        
        {groups.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Wali kuma jirtid koox!</h2>
            <p className="mb-6 text-gray-600">Waxaad isku dayi kartaa inaad:</p>
            <div className="flex flex-col space-y-4 items-center">
              <button
                onClick={() => navigate('/groups')}
                className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-md font-medium"
              >
                Raadi kooxo cusub oo aad ku biiri kartid
              </button>
              <button
                onClick={() => navigate('/create-group')}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-md font-medium"
              >
                Abuur koox cusub
              </button>
              <button
                onClick={() => navigate('/puzzles')}
                className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-md font-medium"
              >
                Qaado puzzle quiz
              </button>
            </div>
          </div>
        )}
        
        {groups.length > 0 && (
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
                
                <div className="flex justify-between items-center mt-4 text-xs text-gray-500">
                  <span>Updated: {formatDate(group.last_message_at)}</span>
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