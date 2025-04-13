import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const VoiceCall = ({ activeCall, currentUser, groupId, onEndCall }) => {
  const [localStream, setLocalStream] = useState(null)
  const [remoteStreams, setRemoteStreams] = useState({})
  const [participants, setParticipants] = useState([])
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoEnabled, setIsVideoEnabled] = useState(false)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [error, setError] = useState(null)
  
  // References for peer connections
  const peerConnections = useRef({})
  const channelRef = useRef(null)
  
  useEffect(() => {
    // Setup realtime subscription for call participants and signaling
    const setupRealtimeSubscription = async () => {
      try {
        // Subscribe to call participants changes
        const participantsChannel = supabase
          .channel(`call:${activeCall.id}:participants`)
          .on('presence', { event: 'sync' }, () => {
            const presenceState = participantsChannel.presenceState()
            const currentParticipants = Object.values(presenceState)
              .flat()
              .map(p => p.user)
            
            setParticipants(currentParticipants)
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              // Track presence for current user
              await participantsChannel.track({
                user: {
                  id: currentUser.id,
                  name: currentUser.user_metadata?.username || 'User',
                  joined_at: new Date().toISOString()
                }
              })
            }
          })
        
        // WebRTC signaling channel
        const signalingChannel = supabase
          .channel(`call:${activeCall.id}:signaling`)
          .on('broadcast', { event: 'signal' }, ({ payload }) => {
            handleSignalingMessage(payload)
          })
          .subscribe()
        
        channelRef.current = {
          participants: participantsChannel,
          signaling: signalingChannel
        }
        
        // Initialize media
        initializeLocalMedia()
        
        return () => {
          // Clean up subscriptions
          if (channelRef.current) {
            channelRef.current.participants.unsubscribe()
            channelRef.current.signaling.unsubscribe()
          }
          
          // Close peer connections
          Object.values(peerConnections.current).forEach(pc => {
            if (pc) pc.close()
          })
          
          // Stop local stream
          if (localStream) {
            localStream.getTracks().forEach(track => track.stop())
          }
        }
      } catch (error) {
        console.error('Error setting up realtime subscription:', error)
        setError('Failed to connect to the call. Please try again.')
      }
    }
    
    if (activeCall && currentUser) {
      setupRealtimeSubscription()
    }
    
    return () => {
      // Cleanup function handled above
    }
  }, [activeCall, currentUser, groupId])
  
  // Initialize local media (microphone/camera)
  const initializeLocalMedia = async () => {
    try {
      const constraints = {
        audio: true,
        video: false // Start with audio-only
      }
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      setLocalStream(stream)
      
      // Initialize peer connections with existing participants
      createPeerConnections()
    } catch (error) {
      console.error('Error accessing media devices:', error)
      setError('Could not access your microphone. Please check permissions.')
    }
  }
  
  // Create peer connections for all participants
  const createPeerConnections = () => {
    participants.forEach(participant => {
      if (participant.id !== currentUser.id && !peerConnections.current[participant.id]) {
        createPeerConnection(participant.id)
      }
    })
  }
  
  // Create a peer connection for a specific participant
  const createPeerConnection = async (participantId) => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      })
      
      // Add local stream tracks to peer connection
      if (localStream) {
        localStream.getTracks().forEach(track => {
          pc.addTrack(track, localStream)
        })
      }
      
      // Handle ICE candidates
      pc.onicecandidate = event => {
        if (event.candidate) {
          sendSignalingMessage({
            type: 'ice-candidate',
            candidate: event.candidate,
            from: currentUser.id,
            to: participantId
          })
        }
      }
      
      // Handle remote stream
      pc.ontrack = event => {
        setRemoteStreams(prev => ({
          ...prev,
          [participantId]: event.streams[0]
        }))
      }
      
      // Create and send offer if we're the initiator
      if (shouldInitiateOffer(currentUser.id, participantId)) {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        
        sendSignalingMessage({
          type: 'offer',
          sdp: pc.localDescription,
          from: currentUser.id,
          to: participantId
        })
      }
      
      // Store the peer connection
      peerConnections.current[participantId] = pc
    } catch (error) {
      console.error('Error creating peer connection:', error)
    }
  }
  
  // Determine if the current user should initiate the offer based on IDs
  const shouldInitiateOffer = (userId1, userId2) => {
    return userId1 < userId2 // Simple convention: lower ID initiates
  }
  
  // Handle signaling messages
  const handleSignalingMessage = async (message) => {
    // Ignore messages not intended for us
    if (message.to !== currentUser.id) return
    
    const senderId = message.from
    
    try {
      // Create peer connection if it doesn't exist
      if (!peerConnections.current[senderId]) {
        createPeerConnection(senderId)
      }
      
      const pc = peerConnections.current[senderId]
      
      switch (message.type) {
        case 'offer':
          await pc.setRemoteDescription(new RTCSessionDescription(message.sdp))
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          
          sendSignalingMessage({
            type: 'answer',
            sdp: pc.localDescription,
            from: currentUser.id,
            to: senderId
          })
          break
          
        case 'answer':
          await pc.setRemoteDescription(new RTCSessionDescription(message.sdp))
          break
          
        case 'ice-candidate':
          await pc.addIceCandidate(new RTCIceCandidate(message.candidate))
          break
          
        default:
          console.warn('Unknown signaling message type:', message.type)
      }
    } catch (error) {
      console.error('Error handling signaling message:', error)
    }
  }
  
  // Send signaling message through the channel
  const sendSignalingMessage = (message) => {
    if (channelRef.current?.signaling) {
      channelRef.current.signaling.send({
        type: 'broadcast',
        event: 'signal',
        payload: message
      })
    }
  }
  
  // Toggle mute/unmute
  const toggleMute = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks()
      audioTracks.forEach(track => {
        track.enabled = !track.enabled
      })
      setIsMuted(!isMuted)
    }
  }
  
  // Toggle video on/off
  const toggleVideo = async () => {
    try {
      if (isVideoEnabled && localStream) {
        // Disable video
        const videoTracks = localStream.getVideoTracks()
        videoTracks.forEach(track => {
          track.stop()
          localStream.removeTrack(track)
        })
        setIsVideoEnabled(false)
      } else {
        // Enable video
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true })
        const videoTrack = videoStream.getVideoTracks()[0]
        
        if (localStream) {
          localStream.addTrack(videoTrack)
          
          // Update all peer connections with the new track
          Object.values(peerConnections.current).forEach(pc => {
            pc.getSenders().forEach(sender => {
              if (sender.track && sender.track.kind === 'video') {
                sender.replaceTrack(videoTrack)
              } else if (!sender.track?.kind === 'video') {
                pc.addTrack(videoTrack, localStream)
              }
            })
          })
          
          setIsVideoEnabled(true)
        }
      }
    } catch (error) {
      console.error('Error toggling video:', error)
      setError('Could not access your camera. Please check permissions.')
    }
  }
  
  // Handle ending the call
  const handleEndCall = async () => {
    try {
      // Update call status in the database
      if (activeCall.created_by === currentUser.id) {
        // If call creator, end the call for everyone
        await supabase
          .from('calls')
          .update({ ended_at: new Date().toISOString() })
          .eq('id', activeCall.id)
      } else {
        // Otherwise just leave the call personally
        await supabase
          .from('call_participants')
          .update({ left_at: new Date().toISOString() })
          .eq('call_id', activeCall.id)
          .eq('user_id', currentUser.id)
      }
      
      // Clean up resources
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop())
      }
      
      Object.values(peerConnections.current).forEach(pc => {
        if (pc) pc.close()
      })
      
      if (channelRef.current) {
        await channelRef.current.participants.untrack()
        channelRef.current.participants.unsubscribe()
        channelRef.current.signaling.unsubscribe()
      }
      
      if (onEndCall) onEndCall()
    } catch (error) {
      console.error('Error ending call:', error)
    }
  }
  
  // Render participant video or audio-only UI
  const renderParticipant = (participant, stream) => {
    return (
      <div 
        key={participant.id} 
        className={`relative rounded-lg overflow-hidden ${isFullScreen ? 'h-full w-full' : 'h-40 w-40'}`}
      >
        {stream && stream.getVideoTracks().length > 0 ? (
          <video 
            ref={el => {
              if (el && stream) el.srcObject = stream
            }}
            autoPlay
            playsInline
            className="h-full w-full object-cover bg-gray-800"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gray-800">
            <div className="h-20 w-20 rounded-full bg-blue-500 flex items-center justify-center">
              <span className="text-white text-xl font-semibold">
                {(participant.name || 'User').charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2">
          <p className="text-white text-sm truncate">
            {participant.name || 'User'} {participant.id === currentUser.id && '(You)'}
          </p>
        </div>
      </div>
    )
  }
  
  return (
    <div className={`bg-gray-900 text-white rounded-lg overflow-hidden ${isFullScreen ? 'fixed inset-0 z-50' : 'h-96'}`}>
      {error && (
        <div className="bg-red-500 p-2 text-white text-center">
          <p>{error}</p>
        </div>
      )}
      
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            Voice Call ({participants.length} {participants.length === 1 ? 'participant' : 'participants'})
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-2 rounded-full hover:bg-gray-700"
            >
              {isFullScreen ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 4a1 1 0 00-1 1v4a1 1 0 102 0V6.414l3.293 3.293a1 1 0 001.414-1.414L7.414 5H10a1 1 0 100-2H5a1 1 0 00-1 1zm10 11a1 1 0 001-1v-4a1 1 0 10-2 0v2.586l-3.293-3.293a1 1 0 00-1.414 1.414L12.586 15H10a1 1 0 100 2h5z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 110-2h4a1 1 0 011 1v4a1 1 0 11-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 112 0v1.586l2.293-2.293a1 1 0 011.414 1.414L6.414 15H8a1 1 0 110 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 110-2h1.586l-2.293-2.293a1 1 0 011.414-1.414L15 13.586V12a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          </div>
        </div>
        
        <div className={`${isFullScreen ? 'h-[calc(100vh-180px)]' : 'h-52'} overflow-y-auto`}>
          <div className="flex flex-wrap gap-2 justify-center">
            {/* Render local user */}
            {localStream && currentUser && renderParticipant(
              {
                id: currentUser.id,
                name: currentUser.user_metadata?.username || 'You'
              },
              localStream
            )}
            
            {/* Render remote participants */}
            {participants
              .filter(p => p.id !== currentUser.id)
              .map(participant => renderParticipant(
                participant,
                remoteStreams[participant.id]
              ))
            }
            
            {/* Show placeholder if no participants */}
            {participants.length <= 1 && (
              <div className="w-full h-full flex items-center justify-center">
                <p className="text-gray-400">Waiting for others to join...</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Controls */}
      <div className="bg-gray-800 p-4 flex justify-center space-x-4">
        <button
          onClick={toggleMute}
          className={`p-3 rounded-full ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          {isMuted ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 00-2.79.588l.77.771A5.944 5.944 0 018 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0114.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z" clipRule="evenodd" />
              <path d="M11.297 9.176a3.5 3.5 0 00-4.474-4.474l.823.823a2.5 2.5 0 012.829 2.829l.822.822zm-2.943 1.299l.822.822a3.5 3.5 0 01-4.474-4.474l.823.823a2.5 2.5 0 002.829 2.829z" />
              <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 001.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 018 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709z" />
              <path fillRule="evenodd" d="M13.646 14.354l-12-12 .708-.708 12 12-.708.708z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
          )}
        </button>
        
        <button
          onClick={toggleVideo}
          className={`p-3 rounded-full ${isVideoEnabled ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          {isVideoEnabled ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              <path d="M14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm3 2h6v4H7V5zm8 8v2h1v-2h-1zm-2-2H7v4h6v-4zm2 0h1V9h-1v2zm1-4V5h-1v2h1zM5 5v2H4V5h1zm0 4H4v2h1V9zm-1 4h1v2H4v-2z" clipRule="evenodd" />
            </svg>
          )}
        </button>
        
        <button
          onClick={handleEndCall}
          className="p-3 rounded-full bg-red-600 hover:bg-red-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
            <path d="M16.707 3.293a1 1 0 00-1.414 0L12 6.586 8.707 3.293a1 1 0 00-1.414 1.414L10.586 8 7.293 11.293a1 1 0 101.414 1.414L12 9.414l3.293 3.293a1 1 0 001.414-1.414L13.414 8l3.293-3.293a1 1 0 000-1.414z" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default VoiceCall 