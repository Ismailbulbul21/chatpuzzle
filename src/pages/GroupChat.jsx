import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import VoiceCall from '../components/VoiceCall'
import { Link } from 'react-router-dom'

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
  const [isAdmin, setIsAdmin] = useState(false)
  const [activeCall, setActiveCall] = useState(null)
  const [isCreatingCall, setIsCreatingCall] = useState(false)
  const [error, setError] = useState(null)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const [showDeleteGroupModal, setShowDeleteGroupModal] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState(null)
  
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
          .select('*, is_admin')
          .eq('group_id', groupId)
          .eq('user_id', user.id)
          .single()
        
        if (memberError || !memberData) {
          // User is not a member of this group
          navigate('/')
          return
        }
        
        // Set admin status
        setIsAdmin(memberData.is_admin || false)
        
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
        
        // Set up realtime subscription for deleted messages
        const deleteSubscription = supabase
          .channel('deleted-messages')
          .on('postgres_changes',
            {
              event: 'DELETE',
              schema: 'public',
              table: 'messages',
              filter: `group_id=eq.${groupId}`
            },
            (payload) => {
              setMessages(prev => prev.filter(msg => msg.id !== payload.old.id))
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
          supabase.removeChannel(deleteSubscription)
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
  
  const handleDeleteMessage = async (messageId) => {
    if (!isAdmin) return
    
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId)
      
      if (error) throw error
      
      // Update the messages list
      setMessages(messages.filter(message => message.id !== messageId))
    } catch (error) {
      console.error('Error deleting message:', error)
      setError('Failed to delete message. Please try again.')
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
  
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  
  const handleRemoveMember = async (userId) => {
    if (!isAdmin) return
    setMemberToRemove(null)
    
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .match({ group_id: groupId, user_id: userId })
      
      if (error) throw error
      
      // If successful, update the members list
      setMembers(members.filter(member => member.user_id !== userId))
      
      // Add system message about removed user
      const memberName = members.find(m => m.user_id === userId)?.profiles?.username || 'A user'
      
      const { error: msgError } = await supabase
        .from('messages')
        .insert({
          group_id: groupId,
          user_id: currentUser.id,
          content: `${memberName} has been removed from the group`,
          is_system_message: true
        })
        
      if (msgError) console.error('Error adding system message:', msgError)
      
    } catch (error) {
      console.error('Error removing member:', error)
      setError('Failed to remove member. Please try again.')
    }
  }
  
  const handleDeleteGroup = async () => {
    if (!isAdmin) return
    setShowDeleteGroupModal(false)
    
    try {
      // First get call session IDs
      const { data: callSessions, error: callSessionsQueryError } = await supabase
        .from('call_sessions')
        .select('id')
        .eq('group_id', groupId);
        
      if (!callSessionsQueryError && callSessions && callSessions.length > 0) {
        // Extract call IDs
        const callIds = callSessions.map(session => session.id);
        
        // Delete call participants for these calls
        const { error: callParticipantsError } = await supabase
          .from('call_participants')
          .delete()
          .in('call_id', callIds);
          
        if (callParticipantsError) {
          console.error('Error deleting call participants:', callParticipantsError);
        }
      }
      
      // Delete call sessions
      const { error: callSessionsError } = await supabase
        .from('call_sessions')
        .delete()
        .eq('group_id', groupId);
      
      if (callSessionsError) {
        console.error('Error deleting call sessions:', callSessionsError);
      }
      
      // Delete all answers to questions first (due to foreign key constraint)
      const { error: answersError } = await supabase
        .from('group_puzzle_answers')
        .delete()
        .eq('group_id', groupId);
        
      if (answersError) {
        console.error('Error deleting group answers:', answersError);
      }
      
      // Then delete questions
      const { error: questionsError } = await supabase
        .from('group_puzzles')
        .delete()
        .eq('group_id', groupId);
        
      if (questionsError) {
        console.error('Error deleting group questions:', questionsError);
      }
      
      // Delete all messages
      const { error: msgError } = await supabase
        .from('messages')
        .delete()
        .eq('group_id', groupId)
      
      if (msgError) throw msgError
      
      // Then delete all group members
      const { error: memberError } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
      
      if (memberError) throw memberError
      
      // Finally delete the group itself
      const { error: groupError } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId)
      
      if (groupError) throw groupError
      
      // Navigate back to home
      navigate('/')
      
    } catch (error) {
      console.error('Error deleting group:', error)
      setError('Failed to delete group. Please try again.')
    }
  }
  
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
      <div className="container mx-auto px-4 py-8">
        {/* Group Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 space-y-3 md:space-y-0">
          <div>
            <Link to="/" className="inline-flex items-center text-blue-600 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              Back
            </Link>
            <h1 className="text-3xl font-bold">{group?.name || 'Loading...'}</h1>
            {group?.description && <p className="text-gray-600 mt-1">{group.description}</p>}
          </div>
          
          <div className="flex space-x-3">
            {!activeCall && (
              <button
                onClick={startCall}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-green-500 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
                Start Call
              </button>
            )}
            
            {isAdmin && (
              <div className="relative inline-block text-left">
                <button
                  type="button"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-red-500 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  onClick={() => setShowDeleteGroupModal(true)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Delete Group
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Delete Group Modal */}
        {showDeleteGroupModal && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md mx-4">
              <h3 className="text-xl font-bold mb-4">Delete Group</h3>
              <p className="mb-6">Are you sure you want to delete this group? This action cannot be undone.</p>
              <div className="flex justify-end space-x-3">
                <button
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  onClick={() => setShowDeleteGroupModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  onClick={handleDeleteGroup}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Member Remove Confirmation Modal */}
        {memberToRemove && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md mx-4">
              <h3 className="text-xl font-bold mb-4">Remove Member</h3>
              <p className="mb-6">Are you sure you want to remove this member from the group?</p>
              <div className="flex justify-end space-x-3">
                <button
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  onClick={() => setMemberToRemove(null)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  onClick={() => handleRemoveMember(memberToRemove)}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
          <div className="flex-1 flex flex-col bg-white rounded-lg shadow-md overflow-hidden h-[80vh]">
            {/* Chat Header */}
            <div className="p-4 border-b flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">{group?.name || 'Chat'}</h2>
                <p className="text-sm text-gray-500">
                  {members.length} xubnood
                </p>
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
                    <div className={`relative max-w-xs md:max-w-md rounded-lg p-3 ${
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
                      
                      {/* Delete button for admins */}
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteMessage(message.id)}
                          className="absolute top-1 right-1 text-xs rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-100 text-red-500"
                          title="Delete message"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
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
                <div key={member.user_id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
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
                  
                  {/* Remove member button (only for admins and not for current user) */}
                  {isAdmin && currentUser && member.user_id !== currentUser.id && (
                    <button
                      onClick={() => setMemberToRemove(member.user_id)}
                      className="text-xs text-red-500 hover:text-red-700"
                      title="Remove from group"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
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