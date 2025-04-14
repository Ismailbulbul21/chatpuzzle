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
          .eq('user_id', user.id);
        
        if (groupsError) throw groupsError;
        
        // Sort the results in JavaScript instead
        const sortedGroups = userGroups?.sort((a, b) => {
          if (!a.last_message_at) return 1;
          if (!b.last_message_at) return -1;
          return new Date(b.last_message_at) - new Date(a.last_message_at);
        }) || [];
        
        if (sortedGroups.length > 0) {
          // Transform the data to match the expected format
          const formattedGroups = sortedGroups.map(group => ({
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
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
        </div>
      </Layout>
    )
  }
  
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 space-y-4 md:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Kooxahaaga</h1>
            <p className="text-gray-600">Ku soo dhawoow BulbulChat</p>
          </div>
          <div className="flex space-x-4">
            <button
              onClick={() => navigate('/groups')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 9a2 2 0 114 0 2 2 0 01-4 0z" />
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a4 4 0 00-3.446 6.032l-2.261 2.26a1 1 0 101.414 1.415l2.261-2.261A4 4 0 1011 5z" clipRule="evenodd" />
              </svg>
              Radi Kooxo
            </button>
            <button
              onClick={() => navigate('/create-group')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Koox Cusub
            </button>
          </div>
        </div>
        
        {error && (
          <div className="mb-8 rounded-lg bg-red-50 p-4 text-sm text-red-600 border border-red-200">
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-2 fill-current" viewBox="0 0 20 20">
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"/>
              </svg>
              {error}
            </div>
          </div>
        )}
        
        {groups.length === 0 && (
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-gray-200 text-center">
            <div className="max-w-md mx-auto">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Wali kuma jirtid koox!</h2>
              <p className="text-gray-600 mb-8">Waxaad isku dayi kartaa inaad:</p>
              <div className="flex flex-col space-y-4">
                <button
                  onClick={() => navigate('/groups')}
                  className="w-full px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg hover:from-emerald-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                >
                  Raadi kooxo cusub oo aad ku biiri kartid
                </button>
                <button
                  onClick={() => navigate('/create-group')}
                  className="w-full px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                >
                  Abuur koox cusub
                </button>
                <button
                  onClick={() => navigate('/puzzles')}
                  className="w-full px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-pink-500 to-rose-500 rounded-lg hover:from-pink-600 hover:to-rose-600 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                >
                  Qaado puzzle quiz
                </button>
              </div>
            </div>
          </div>
        )}
        
        {groups.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => (
              <Link
                key={group.id}
                to={`/chat/${group.id}`}
                className="bg-white/80 backdrop-blur-lg rounded-xl shadow-md p-6 hover:shadow-xl transition-all duration-200 border border-gray-200 transform hover:-translate-y-1"
              >
                <div className="flex items-start justify-between mb-3">
                  <h2 className="text-xl font-semibold text-gray-900 truncate">{group.name}</h2>
                  {group.is_admin && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-800">
                      Admin
                    </span>
                  )}
                </div>
                
                {group.description && (
                  <p className="text-gray-600 text-sm line-clamp-2 mb-4">{group.description}</p>
                )}
                
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-1 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
                    </svg>
                    {formatDate(group.last_message_at)}
                  </span>
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