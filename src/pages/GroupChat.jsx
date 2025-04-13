import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import VoiceCall from '../components/VoiceCall'

const GroupChat = () => {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [activeCall, setActiveCall] = useState(null)
  const [isCreatingCall, setIsCreatingCall] = useState(false)
  const [error, setError] = useState(null)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  
  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  
  useEffect(() => {
    scrollToBottom()
  }, [messages])
  
  useEffect(() => {
    const fetchGroupData = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        
        setCurrentUser(user)
        
        // Check if user is member of the group
        const { data: memberData, error: memberError } = await supabase
          .from('group_members')
          .select('*')
          .eq('group_id', groupId)
          .eq('user_id', user.id)
          .single()
        
        if (memberError || !memberData) {
          // User is not a member of this group
          navigate('/')
          return
        }
        
        // Fetch group details
        const { data: groupData, error: groupError } = await supabase
          .from('groups')
          .select('*')
          .eq('id', groupId)
          .single()
        
        if (groupError) throw groupError
        
        if (groupData) {
          setGroup(groupData)
        }
        
        // Fetch group members
        const { data: membersData, error: membersError } = await supabase
          .from('group_members')
          .select(`
            user_id,
            is_admin,
            joined_at,
            profiles:user_id (
              username,
              full_name,
              avatar_url,
              is_online
            )
          `)
          .eq('group_id', groupId)
        
        if (membersError) throw membersError
        
        if (membersData) {
          setMembers(membersData)
        }
        
        // Fetch messages
        const { data: messagesData, error: messagesError } = await supabase
          .from('messages')
          .select(`
            id,
            content,
            is_meme,
            media_url,
            created_at,
            user_id,
            profiles:user_id (
              username,
              full_name,
              avatar_url
            )
          `)
          .eq('group_id', groupId)
          .order('created_at', { ascending: true })
        
        if (messagesError) throw messagesError
        
        if (messagesData) {
          setMessages(messagesData)
        }
        
        // Check for active call
        const { data: activeCallData, error: activeCallError } = await supabase
          .from('call_sessions')
          .select('*')
          .eq('group_id', groupId)
          .eq('is_active', true)
          .maybeSingle()
        
        if (!activeCallError && activeCallData) {
          setActiveCall(activeCallData)
        }
        
        // Set up realtime subscription for new messages
        const messagesSubscription = supabase
          .channel('messages-channel')
          .on('postgres_changes', 
            { 
              event: 'INSERT', 
              schema: 'public', 
              table: 'messages',
              filter: `group_id=eq.${groupId}`
            }, 
            async (payload) => {
              // Fetch the full message with profile information
              const { data: newMsg, error: msgError } = await supabase
                .from('messages')
                .select(`
                  id,
                  content,
                  is_meme,
                  media_url,
                  created_at,
                  user_id,
                  profiles:user_id (
                    username,
                    full_name,
                    avatar_url
                  )
                `)
                .eq('id', payload.new.id)
                .single()
              
              if (!msgError && newMsg) {
                setMessages(prev => [...prev, newMsg])
              }
            }
          )
          .subscribe()
        
        // Set up realtime subscription for call sessions
        const callsSubscription = supabase
          .channel('calls-channel')
          .on('postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'call_sessions',
              filter: `group_id=eq.${groupId}`
            },
            async (payload) => {
              if (payload.new && payload.new.is_active) {
                setActiveCall(payload.new)
              } else {
                setActiveCall(null)
              }
            }
          )
          .subscribe()
        
        return () => {
          supabase.removeChannel(messagesSubscription)
          supabase.removeChannel(callsSubscription)
        }
      } catch (error) {
        console.error('Error fetching group data:', error)
        setError('Khalad ayaa dhacay markii lagu waday inaan keeno xogta kooxda')
      } finally {
        setLoading(false)
      }
    }
    
    fetchGroupData()
  }, [groupId, navigate])
  
  const handleSendMessage = async (e) => {
    e.preventDefault()
    
    if (!newMessage.trim()) return
    
    setSending(true)
    
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          group_id: groupId,
          user_id: currentUser.id,
          content: newMessage,
          is_meme: false
        })
      
      if (error) throw error
      
      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
      setError('Khalad ayaa dhacay markii la diraayay fariinta')
    } finally {
      setSending(false)
    }
  }
  
  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    setSending(true)
    setError(null)
    
    try {
      // Upload the file
      const fileExt = file.name.split('.').pop()
      const fileName = `${groupId}/${currentUser.id}-${Math.random()}.${fileExt}`
      const filePath = `media/${fileName}`
      
      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })
      
      if (uploadError) throw uploadError
      
      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath)
      
      if (!urlData || !urlData.publicUrl) {
        throw new Error('Failed to get public URL for uploaded file')
      }
      
      // Send message with media
      const { error: msgError } = await supabase
        .from('messages')
        .insert({
          group_id: groupId,
          user_id: currentUser.id,
          content: 'Sawir/meme ayaa la diray',
          is_meme: true,
          media_url: urlData.publicUrl
        })
      
      if (msgError) throw msgError
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      setError('Khalad ayaa dhacay markii la dirayay sawirka')
    } finally {
      setSending(false)
    }
  }
  
  // Create or start a call
  const startCall = async () => {
    if (activeCall) return
    
    setIsCreatingCall(true)
    setError(null)
    
    try {
      // Create a new call session in the database
      const { data: callData, error: callError } = await supabase
        .from('call_sessions')
        .insert({
          group_id: groupId,
          started_by: currentUser.id,
          is_active: true,
          started_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (callError) throw callError
      
      // Add current user as participant
      const { error: participantError } = await supabase
        .from('call_participants')
        .insert({
          call_id: callData.id,
          user_id: currentUser.id,
          joined_at: new Date().toISOString()
        })
      
      if (participantError) throw participantError
      
      // Send notification to group
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          group_id: groupId,
          user_id: currentUser.id,
          content: `${currentUser.username || 'Someone'} started a voice call`,
          is_system_message: true
        })
        
      if (messageError) console.error('Error sending call notification:', messageError)
      
      setActiveCall(callData)
    } catch (error) {
      console.error('Error starting call:', error)
      setError('Failed to start voice call')
    } finally {
      setIsCreatingCall(false)
    }
  }
  
  // End a call
  const endCall = async () => {
    if (!activeCall) return
    
    try {
      if (activeCall.started_by === currentUser.id) {
        // End call for everyone if creator
        await supabase
          .from('call_sessions')
          .update({ 
            is_active: false,
            ended_at: new Date().toISOString() 
          })
          .eq('id', activeCall.id)
          
        // Send notification to group
        const { error: messageError } = await supabase
          .from('messages')
          .insert({
            group_id: groupId,
            user_id: currentUser.id,
            content: `${currentUser.username || 'Someone'} ended the voice call`,
            is_system_message: true
          })
          
        if (messageError) console.error('Error sending call end notification:', messageError)
      } else {
        // Just leave the call if not creator
        await supabase
          .from('call_participants')
          .update({ left_at: new Date().toISOString() })
          .eq('call_id', activeCall.id)
          .eq('user_id', currentUser.id)
          
        // Send notification about user leaving
        const { error: messageError } = await supabase
          .from('messages')
          .insert({
            group_id: groupId,
            user_id: currentUser.id,
            content: `${currentUser.username || 'Someone'} left the voice call`,
            is_system_message: true
          })
          
        if (messageError) console.error('Error sending call leave notification:', messageError)
      }
      
      setActiveCall(null)
    } catch (error) {
      console.error('Error ending call:', error)
      setError('Failed to end call')
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
  
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('so-SO', { hour: '2-digit', minute: '2-digit' })
  }
  
  return (
    <Layout>
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Chat Area */}
          <div className="w-full md:w-3/4 bg-white rounded-lg shadow-md flex flex-col h-[calc(100vh-10rem)]">
            {/* Group Header */}
            <div className="border-b p-4 flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold">{group?.name}</h1>
                <p className="text-sm text-gray-500">{members.length} xubnood</p>
              </div>
              
              <div className="flex items-center space-x-2">
                {activeCall ? (
                  <button
                    onClick={endCall}
                    className="bg-red-500 hover:bg-red-700 text-white px-4 py-2 rounded-md flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                      <path d="M16.707 3.293a1 1 0 00-1.414 0L12 6.586 8.707 3.293a1 1 0 00-1.414 1.414L10.586 8 7.293 11.293a1 1 0 101.414 1.414L12 9.414l3.293 3.293a1 1 0 001.414-1.414L13.414 8l3.293-3.293a1 1 0 000-1.414z" />
                    </svg>
                    Ka bax wicitaanka
                  </button>
                ) : (
                  <button
                    onClick={startCall}
                    disabled={isCreatingCall}
                    className="bg-green-500 hover:bg-green-700 text-white px-4 py-2 rounded-md flex items-center disabled:opacity-50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                    </svg>
                    Bilaw wicitaan
                  </button>
                )}
              </div>
            </div>
            
            {/* Messages */}
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">Fariimo kuma jiraan weli. Noqo midka ugu horreeya ee farriin dira!</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.user_id === currentUser.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-xs md:max-w-md rounded-lg p-3 ${
                      message.user_id === currentUser.id
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-800'
                    }`}>
                      {message.user_id !== currentUser.id && (
                        <div className="font-bold text-sm mb-1">{message.profiles?.username || 'Unknown'}</div>
                      )}
                      
                      {message.is_meme && message.media_url && (
                        <img src={message.media_url} alt="Meme" className="rounded-md mb-2 max-w-full" />
                      )}
                      
                      <p>{message.content}</p>
                      
                      <div className={`text-xs mt-1 ${
                        message.user_id === currentUser.id ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        {formatDate(message.created_at)}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Input Area */}
            <div className="border-t p-4">
              {error && (
                <div className="mb-2 bg-red-50 p-2 rounded-md">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}
              
              <form onSubmit={handleSendMessage} className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-grow p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Qor farrintaada..."
                  disabled={sending}
                />
                
                <label className="cursor-pointer p-2 border rounded-md bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                  </svg>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={sending}
                  />
                </label>
                
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="p-2 border rounded-md bg-blue-500 hover:bg-blue-700 text-white flex items-center justify-center disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </button>
              </form>
            </div>
          </div>
          
          {/* Members Sidebar */}
          <div className="w-full md:w-1/4 bg-white rounded-lg shadow-md p-4">
            <h2 className="text-lg font-bold mb-4">Xubnahooda</h2>
            
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.user_id} className="flex items-center space-x-2">
                  <div className="relative">
                    {member.profiles?.avatar_url ? (
                      <img
                        src={member.profiles.avatar_url}
                        alt={member.profiles.username}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                        <span className="text-gray-600">
                          {member.profiles?.username?.charAt(0) || '?'}
                        </span>
                      </div>
                    )}
                    
                    <span 
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border border-white ${
                        member.profiles?.is_online ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                    />
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium">
                      {member.profiles?.username || 'Unknown'}
                      {member.is_admin && <span className="ml-1 text-xs text-blue-500">(Admin)</span>}
                    </p>
                    {member.profiles?.full_name && (
                      <p className="text-xs text-gray-500">{member.profiles.full_name}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {activeCall && currentUser && (
              <div className="mt-6">
                <VoiceCall 
                  activeCall={activeCall}
                  currentUser={currentUser}
                  groupId={groupId}
                  onEndCall={endCall}
                  members={members}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default GroupChat 