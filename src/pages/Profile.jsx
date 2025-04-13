import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const Profile = () => {
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [profile, setProfile] = useState(null)
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [badges, setBadges] = useState([])
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        
        // Fetch profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (profileError) throw profileError
        
        if (profileData) {
          setProfile(profileData)
          setUsername(profileData.username || '')
          setFullName(profileData.full_name || '')
          setBio(profileData.bio || '')
          setAvatarUrl(profileData.avatar_url || '')
        }
        
        // Fetch badges
        const { data: badgesData, error: badgesError } = await supabase
          .from('user_badges')
          .select(`
            badges:badge_id (
              id,
              name,
              description,
              image_url
            )
          `)
          .eq('user_id', user.id)
        
        if (badgesError) throw badgesError
        
        if (badgesData) {
          setBadges(badgesData.map(item => item.badges))
        }
      } catch (error) {
        console.error('Error fetching profile:', error)
        setError('Khalad ayaa dhacay markii lagu waday inaan keeno xogtaada shaqsiga')
      } finally {
        setLoading(false)
      }
    }
    
    fetchProfile()
  }, [])
  
  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setAvatarFile(file)
      // Preview the selected image
      const reader = new FileReader()
      reader.onload = (e) => {
        setAvatarUrl(e.target.result)
      }
      reader.readAsDataURL(file)
    }
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setUpdating(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')
      
      // Upload avatar if changed
      let newAvatarUrl = profile.avatar_url
      
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop()
        const fileName = `${user.id}-${Math.random()}.${fileExt}`
        const filePath = `avatars/${fileName}`
        
        const { error: uploadError } = await supabase.storage
          .from('profiles')
          .upload(filePath, avatarFile)
        
        if (uploadError) throw uploadError
        
        const { data: urlData } = supabase.storage
          .from('profiles')
          .getPublicUrl(filePath)
        
        newAvatarUrl = urlData.publicUrl
      }
      
      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          username,
          full_name: fullName,
          bio,
          avatar_url: newAvatarUrl
        })
        .eq('id', user.id)
      
      if (updateError) throw updateError
      
      setSuccess('Waa la cusbooneysiiyay xogtaada shaqsiga')
    } catch (error) {
      console.error('Error updating profile:', error)
      setError('Khalad ayaa dhacay markii la cusbooneysiinayay xogtaada')
    } finally {
      setUpdating(false)
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
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Profile Form */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h1 className="text-2xl font-bold mb-6">Bogga Shaqsiga</h1>
              
              {error && (
                <div className="mb-4 bg-red-50 p-4 rounded-md">
                  <p className="text-red-700">{error}</p>
                </div>
              )}
              
              {success && (
                <div className="mb-4 bg-green-50 p-4 rounded-md">
                  <p className="text-green-700">{success}</p>
                </div>
              )}
              
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-bold text-gray-700 mb-2" htmlFor="username">
                    Magaca adeegsiga
                  </label>
                  <input
                    id="username"
                    type="text"
                    className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-bold text-gray-700 mb-2" htmlFor="fullName">
                    Magaca oo dhan
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-bold text-gray-700 mb-2" htmlFor="bio">
                    Ku saabsan
                  </label>
                  <textarea
                    id="bio"
                    className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                    rows={4}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Wax ku saabsan naftaada..."
                  />
                </div>
                
                <div className="mb-6">
                  <label className="block text-sm font-bold text-gray-700 mb-2" htmlFor="avatar">
                    Sawirka shaqsiga
                  </label>
                  
                  <div className="flex items-center space-x-4">
                    {avatarUrl && (
                      <img
                        src={avatarUrl}
                        alt="Avatar"
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    )}
                    
                    <input
                      id="avatar"
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="p-2"
                    />
                  </div>
                </div>
                
                <button
                  type="submit"
                  disabled={updating}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
                >
                  {updating ? 'Waa la cusbooneysiinayaa...' : 'Cusboonaysii'}
                </button>
              </form>
            </div>
          </div>
          
          {/* Badges */}
          <div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">Shahaadooyinka</h2>
              
              {badges.length === 0 ? (
                <p className="text-gray-600">
                  Ma haysatid weli shahaadooyin. Ka qeyb gal dhaqdhaqaaqyada si aad u hesho shahaadooyin.
                </p>
              ) : (
                <div className="space-y-4">
                  {badges.map((badge) => (
                    <div key={badge.id} className="flex items-center space-x-3 p-2 border rounded-md">
                      {badge.image_url && (
                        <img
                          src={badge.image_url}
                          alt={badge.name}
                          className="w-10 h-10 object-cover"
                        />
                      )}
                      <div>
                        <h3 className="font-bold">{badge.name}</h3>
                        <p className="text-sm text-gray-600">{badge.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default Profile 