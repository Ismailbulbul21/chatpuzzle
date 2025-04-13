import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { generateQuizQuestions } from '../lib/geminiService'
import { PUZZLE_CATEGORIES, DEFAULT_PUZZLE_COUNT } from '../lib/config'
import Layout from '../components/Layout'

const Puzzles = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [puzzles, setPuzzles] = useState([])
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0)
  const [responses, setResponses] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [source, setSource] = useState('database') // 'database' or 'api'
  const [aiGenerating, setAiGenerating] = useState(false)
  
  useEffect(() => {
    const fetchPuzzles = async () => {
      try {
        // Get user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        
        // First try to fetch AI-generated questions using Gemini API
        setAiGenerating(true)
        setSource('api')
        try {
          console.log("Attempting to generate questions with Gemini API");
          const generatedQuestions = await generateQuizQuestions(PUZZLE_CATEGORIES, DEFAULT_PUZZLE_COUNT)
          
          if (generatedQuestions && generatedQuestions.length > 0) {
            console.log("Successfully generated questions:", generatedQuestions.length);
            // Add temporary IDs to the AI-generated questions
            const questionsWithIds = generatedQuestions.map((q, index) => ({
              ...q,
              id: `ai-${Date.now()}-${index}`
            }))
            
            setPuzzles(questionsWithIds)
            setAiGenerating(false)
            setLoading(false)
            return
          } else {
            console.warn("Generated questions array is empty");
          }
        } catch (apiError) {
          console.error('Error generating questions from API:', apiError);
          setError(`API error: ${apiError.message || 'Unknown error'}`);
          setSource('database') // Fallback to database if API fails
        }
        
        setAiGenerating(false)
        
        // Fallback: fetch questions from database if API fails
        const { data, error } = await supabase
          .from('puzzles')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(7)
        
        if (error) throw error
        
        if (data) {
          setPuzzles(data)
        }
      } catch (error) {
        console.error('Error fetching puzzles:', error)
        setError('Khalad ayaa dhacay markii lagu waday inaan keeno su\'aalaha puzzleka')
      } finally {
        setLoading(false)
      }
    }
    
    fetchPuzzles()
  }, [])
  
  const handleResponseChange = (puzzle_id, response) => {
    setResponses(prev => ({
      ...prev,
      [puzzle_id]: response
    }))
  }
  
  const handleNext = () => {
    const currentPuzzle = puzzles[currentPuzzleIndex]
    
    // Validate response
    if (!responses[currentPuzzle.id]) {
      setError('Fadlan ka jawaab su\'aasha kahor intaadan u gudbin kan xiga.')
      return
    }
    
    setError(null)
    setCurrentPuzzleIndex(prev => prev + 1)
  }
  
  const handleSubmit = async () => {
    const currentPuzzle = puzzles[currentPuzzleIndex]
    
    // Validate response
    if (!responses[currentPuzzle.id]) {
      setError('Fadlan ka jawaab su\'aasha kahor intaadan gudbin.')
      return
    }
    
    setError(null)
    setSubmitting(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')
      
      // If questions were from API, first save them to database
      if (source === 'api') {
        // Convert AI-generated questions to database format
        const questionsToSave = puzzles.map(puzzle => ({
          category: puzzle.category,
          question: puzzle.question,
          options: puzzle.options, // Already in correct format
          is_active: true
        }))
        
        // Save questions to database
        const { error: saveError } = await supabase
          .from('puzzles')
          .insert(questionsToSave)
          
        if (saveError) {
          console.error('Error saving AI-generated questions:', saveError)
          // Continue anyway, not critical
        }
      }
      
      // Submit all responses
      const responsePromises = Object.entries(responses).map(([puzzle_id, response]) => {
        // For AI-generated questions, create a new UUID instead of using null
        const finalPuzzleId = puzzle_id.startsWith('ai-') 
          ? crypto.randomUUID() 
          : puzzle_id;
          
        return supabase
          .from('puzzle_responses')
          .insert({  // Use insert instead of upsert for AI-generated puzzle IDs
            user_id: user.id,
            puzzle_id: finalPuzzleId,
            response,
            response_vector: null
          });
      })
      
      await Promise.all(responsePromises)
      
      // Still update last puzzle attempt timestamp for tracking
      await supabase
        .from('profiles')
        .update({ last_puzzle_attempt: new Date().toISOString() })
        .eq('id', user.id)
      
      // Call the matching function to create or join a group
      const { data: groupData, error: groupError } = await supabase
        .rpc('create_or_join_group', { 
          user_uuid: user.id,
          similarity_threshold: 0.7
        })
      
      if (groupError) throw groupError
      
      // Navigate to group chat if a group was assigned
      if (groupData) {
        navigate(`/chat/${groupData}`)
      } else {
        navigate('/')
      }
    } catch (error) {
      console.error('Error submitting responses:', error)
      setError('Khalad ayaa dhacay markii jawaabaha la gudbinayay')
    } finally {
      setSubmitting(false)
    }
  }
  
  if (loading || aiGenerating) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          {aiGenerating && (
            <p className="text-gray-600">Waxaan soo abuurayaa su'aalo cusub...</p>
          )}
        </div>
      </Layout>
    )
  }
  
  if (error && puzzles.length === 0) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 p-4 rounded-md">
            <p className="text-red-700">{error}</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Ku noqo Bogga Hore
          </button>
        </div>
      </Layout>
    )
  }
  
  const currentPuzzle = puzzles[currentPuzzleIndex]
  const isLastPuzzle = currentPuzzleIndex === puzzles.length - 1
  
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-6 flex justify-between items-center">
            <h1 className="text-2xl font-bold">Puzzle {currentPuzzleIndex + 1}/{puzzles.length}</h1>
            <span className="text-sm text-gray-500">Qeybta: {currentPuzzle?.category}</span>
            {source === 'api' && (
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">AI-generated</span>
            )}
          </div>
          
          <div className="mb-8">
            <h2 className="text-xl mb-4">{currentPuzzle?.question}</h2>
            
            {currentPuzzle?.options ? (
              // Multiple choice question
              <div className="space-y-2">
                {(() => {
                  try {
                    const parsedOptions = typeof currentPuzzle.options === 'string' 
                      ? JSON.parse(currentPuzzle.options) 
                      : currentPuzzle.options;
                      
                    return Array.isArray(parsedOptions) ? parsedOptions.map((option, index) => (
                      <div key={index} className="flex items-center">
                        <input
                          type="radio"
                          id={`option-${index}`}
                          name={`puzzle-${currentPuzzle.id}`}
                          value={option}
                          checked={responses[currentPuzzle.id] === option}
                          onChange={() => handleResponseChange(currentPuzzle.id, option)}
                          className="mr-2"
                        />
                        <label htmlFor={`option-${index}`}>{option}</label>
                      </div>
                    )) : (
                      <div className="text-red-500">
                        Invalid options format. Please contact administrator.
                      </div>
                    );
                  } catch (error) {
                    console.error("Error parsing options:", error);
                    // Fallback to text input if JSON parsing fails
                    return (
                      <textarea
                        value={responses[currentPuzzle.id] || ''}
                        onChange={(e) => handleResponseChange(currentPuzzle.id, e.target.value)}
                        className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                        rows={4}
                        placeholder="Halkaan ku qor jawaabtaada..."
                      />
                    );
                  }
                })()}
              </div>
            ) : (
              // Open-ended question
              <textarea
                value={responses[currentPuzzle.id] || ''}
                onChange={(e) => handleResponseChange(currentPuzzle.id, e.target.value)}
                className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                rows={4}
                placeholder="Halkaan ku qor jawaabtaada..."
              />
            )}
          </div>
          
          {error && (
            <div className="mb-4 bg-red-50 p-4 rounded-md">
              <p className="text-red-700">{error}</p>
            </div>
          )}
          
          <div className="flex justify-between">
            <button
              onClick={() => navigate('/')}
              className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              Ka bax
            </button>
            
            {isLastPuzzle ? (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
              >
                {submitting ? 'Waa la gudbinayaa...' : 'Gudbii jawaabaha'}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              >
                Kan xiga
              </button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default Puzzles 