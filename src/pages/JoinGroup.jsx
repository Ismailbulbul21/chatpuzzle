import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, logDbOperation, ensureGroupHasQuestions } from '../lib/supabase'
import Layout from '../components/Layout'

// Utility function to fix groups with no questions - can be called from browser console
window.fixGroupWithNoQuestions = async (groupId) => {
  if (!groupId) {
    console.error('Please provide a group ID');
    return;
  }
  
  console.log('Fixing group with ID:', groupId);
  
  // Create default questions for the group
  const defaultQuestions = [
    {
      group_id: groupId,
      question: 'Do you want to join this group?',
      options: JSON.stringify(['Yes, I do', 'No, I don\'t', 'Maybe later', 'I\'m not sure']),
      correct_answer: 0,
      is_active: true
    },
    {
      group_id: groupId,
      question: 'What are you interested in discussing in this group?',
      options: JSON.stringify(['General topics', 'Specific interests', 'Meeting new people', 'Learning together']),
      correct_answer: 0,
      is_active: true
    }
  ];
  
  try {
    const { data, error } = await supabase
      .from('group_puzzles')
      .insert(defaultQuestions)
      .select();
    
    if (error) {
      console.error('Error adding questions:', error);
      return false;
    }
    
    console.log('Successfully added questions:', data);
    console.log('Please reload the page to see the questions');
    return true;
  } catch (err) {
    console.error('Exception adding questions:', err);
    return false;
  }
};

const JoinGroup = () => {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [group, setGroup] = useState(null)
  const [questions, setQuestions] = useState([])
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState({})
  const [error, setError] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [results, setResults] = useState(null)
  const [isFixingGroup, setIsFixingGroup] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('JoinGroup: Starting to fetch data for group ID:', groupId);
        
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError) {
          console.error('Error fetching user:', userError);
          throw userError;
        }
        
        if (!user) {
          console.log('No authenticated user found');
          navigate('/login')
          return
        }
        
        console.log('User authenticated:', user.id);
        setCurrentUser(user)

        // Check if already a member
        const { data: memberData, error: memberError } = await supabase
          .from('group_members')
          .select('*')
          .eq('group_id', groupId)
          .eq('user_id', user.id)
          .maybeSingle()
        
        logDbOperation('SELECT', 'group_members', memberData, memberError);

        if (memberData) {
          // Already a member, redirect to chat
          console.log('User is already a member of this group');
          navigate(`/chat/${groupId}`)
          return
        }
        
        // Clean up any previous answers for this user in this group
        // This ensures they start fresh when taking the quiz again
        const { error: cleanupError } = await supabase
          .from('group_puzzle_answers')
          .delete()
          .match({ 
            user_id: user.id,
            group_id: groupId 
          })
        
        if (cleanupError) {
          console.error('Error cleaning up previous answers:', cleanupError)
          // Continue anyway - not critical
        } else {
          console.log('Successfully cleaned up previous answers');
        }

        // Fetch group details
        const { data: groupData, error: groupError } = await supabase
          .from('groups')
          .select('*')
          .eq('id', groupId)
          .single()
        
        logDbOperation('SELECT', 'groups', groupData, groupError);

        if (groupError) {
          console.error('Error fetching group:', groupError);
          throw groupError
        }

        if (!groupData) {
          console.error('Group not found:', groupId);
          setError('Group not found');
          setLoading(false);
          return;
        }

        console.log('Group found:', groupData);
        setGroup(groupData)

        // Fetch group questions
        const { data: questionsData, error: questionsError } = await supabase
          .from('group_puzzles')
          .select('*')
          .eq('group_id', groupId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })

        logDbOperation('SELECT', 'group_puzzles', questionsData, questionsError);
        console.log('Fetched group questions:', { 
          groupId, 
          questionsCount: questionsData?.length || 0,
          hasError: !!questionsError
        });

        if (questionsError) {
          console.error('Error fetching questions:', questionsError);
          throw questionsError
        }

        if (!questionsData || questionsData.length === 0) {
          console.error('No questions found for group:', groupId);
          
          // Attempt to auto-fix by adding questions
          setIsFixingGroup(true);
          setError('This group has no questions. Attempting to fix automatically...');
          
          // Only allow auto-fix if user is member of at least one group (indicating they're a regular user)
          const { data: userGroups } = await supabase
            .from('group_members')
            .select('group_id')
            .eq('user_id', user.id);
            
          if (userGroups && userGroups.length > 0) {
            const fixed = await ensureGroupHasQuestions(groupId);
            
            if (fixed) {
              // Success! Reload the page to see the questions
              setError('Group fixed successfully! Loading questions...');
              setTimeout(() => window.location.reload(), 1500);
              return;
            } else {
              setError('This group has no questions and could not be fixed automatically. Please contact the administrator.');
            }
          } else {
            setError('This group has no questions. Please contact the administrator.');
          }
          
          setLoading(false);
          return;
        }

        // Check question format
        const invalidQuestions = questionsData.filter(q => !q.question || !q.options);
        if (invalidQuestions.length > 0) {
          console.error('Found invalid questions:', invalidQuestions);
        }

        // Log all question data for debugging
        questionsData.forEach((q, i) => {
          console.log(`Question ${i+1}:`, {
            id: q.id,
            question: q.question,
            optionsType: typeof q.options,
            hasOptions: !!q.options,
            optionsLength: typeof q.options === 'string' 
              ? JSON.parse(q.options).length 
              : Array.isArray(q.options) ? q.options.length : 'unknown'
          });
        });

        // Shuffle the questions for variety
        const shuffledQuestions = [...questionsData].sort(() => 0.5 - Math.random())
        
        // Take only 7 questions or all if less than 7
        const finalQuestions = shuffledQuestions.slice(0, 7)
        setQuestions(finalQuestions)
      } catch (error) {
        console.error('Error fetching group data:', error)
        setError(`An error occurred while loading the group quiz: ${error.message}`)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [groupId, navigate])

  const handleAnswerSelect = (questionId, answerId) => {
    setAnswers({
      ...answers,
      [questionId]: answerId
    })
  }

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    }
  }

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1)
    }
  }

  const handleSubmit = async () => {
    if (Object.keys(answers).length < questions.length) {
      setError('Please answer all questions before submitting')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      // First delete any existing answers for this user in this group
      const { error: deleteError } = await supabase
        .from('group_puzzle_answers')
        .delete()
        .match({ 
          user_id: currentUser.id,
          group_id: groupId
        })
      
      if (deleteError) {
        console.error('Error clearing previous answers:', deleteError)
        // Continue anyway - not critical
      }
      
      // Calculate score
      let correctAnswers = 0
      const answerDetails = questions.map(q => {
        const isCorrect = answers[q.id] === q.correct_answer
        if (isCorrect) correctAnswers++
        return {
          question_id: q.id,
          user_answer: answers[q.id],
          is_correct: isCorrect
        }
      })

      // Save answers
      const { error: answerError } = await supabase
        .from('group_puzzle_answers')
        .insert(answerDetails.map(a => ({
          user_id: currentUser.id,
          group_id: groupId,
          question_id: a.question_id,
          user_answer: a.user_answer,
          is_correct: a.is_correct
        })))

      if (answerError) throw answerError

      // Check if user passed the quiz
      const passed = correctAnswers >= group.min_correct_answers
      
      setResults({
        score: correctAnswers,
        total: questions.length,
        required: group.min_correct_answers,
        passed
      })

      if (passed) {
        // Add user to group
        const { error: memberError } = await supabase
          .from('group_members')
          .insert({
            group_id: groupId,
            user_id: currentUser.id,
            is_admin: false,
            joined_by_quiz: true
          })

        if (memberError) throw memberError
      }
    } catch (error) {
      console.error('Error submitting answers:', error)
      setError('An error occurred while submitting your answers')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || isFixingGroup) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          {isFixingGroup && (
            <p className="mt-4 text-gray-600">Attempting to fix group...</p>
          )}
        </div>
      </Layout>
    )
  }

  if (results) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-8 px-4">
          <div className="bg-white shadow-md rounded-lg p-6">
            <h1 className="text-2xl font-bold mb-4">Quiz Results</h1>
            
            <div className="mb-6">
              <p className="text-xl mb-2">
                You scored: <span className="font-bold">{results.score}</span> out of {results.total}
              </p>
              <p className="mb-4">
                Required to pass: {results.required} correct answers
              </p>
              
              {results.passed ? (
                <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4">
                  <p className="font-bold">Congratulations!</p>
                  <p>You have successfully joined the group.</p>
                </div>
              ) : (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
                  <p className="font-bold">Sorry!</p>
                  <p>You didn't get enough correct answers to join this group.</p>
                </div>
              )}
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={() => results.passed ? navigate(`/chat/${groupId}`) : navigate('/puzzles')}
                className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                {results.passed ? 'Go to Group Chat' : 'Back to Puzzles'}
              </button>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  if (!group || questions.length === 0) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-8 px-4">
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4">
            <p className="font-bold">Error</p>
            <p>{error || 'This group could not be found or has no questions'}</p>
          </div>
          <div className="mt-4">
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Back to Home
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  const currentQuestionData = questions[currentQuestion]

  return (
    <Layout>
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="bg-white shadow-md rounded-lg p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-2">{group.name}</h1>
            <p className="text-gray-600">{group.description}</p>
            <p className="mt-4 text-sm text-gray-500">
              You need to answer at least {group.min_correct_answers} out of {questions.length} questions correctly to join this group.
            </p>
          </div>
          
          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
              {error}
            </div>
          )}
          
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Question {currentQuestion + 1} of {questions.length}</h2>
              <div className="text-sm text-gray-500">
                {Object.keys(answers).length} of {questions.length} answered
              </div>
            </div>
            
            <div className="p-4 border rounded-md mb-4">
              <p className="text-lg mb-4">{currentQuestionData.question}</p>
              
              <div className="space-y-2">
                {(() => {
                  // Parse options if they're stored as a JSON string
                  const options = typeof currentQuestionData.options === 'string' 
                    ? JSON.parse(currentQuestionData.options) 
                    : currentQuestionData.options;
                  
                  return options.map((option, index) => (
                    <label key={index} className="flex items-center p-3 rounded-md border cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name={`question-${currentQuestionData.id}`}
                        value={index}
                        checked={answers[currentQuestionData.id] === index}
                        onChange={() => handleAnswerSelect(currentQuestionData.id, index)}
                        className="mr-3"
                      />
                      <span>{option}</span>
                    </label>
                  ));
                })()}
              </div>
            </div>
            
            <div className="flex justify-between">
              <button
                onClick={handlePrevious}
                disabled={currentQuestion === 0}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-50"
              >
                Previous
              </button>
              
              {currentQuestion < questions.length - 1 ? (
                <button
                  onClick={handleNext}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting || Object.keys(answers).length < questions.length}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Answers'}
                </button>
              )}
            </div>
          </div>
          
          <div className="flex justify-center mt-6">
            <div className="flex space-x-1">
              {questions.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentQuestion(index)}
                  className={`w-4 h-4 rounded-full ${
                    currentQuestion === index
                      ? 'bg-blue-500'
                      : answers[questions[index].id] !== undefined
                      ? 'bg-green-500'
                      : 'bg-gray-300'
                  }`}
                  aria-label={`Go to question ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default JoinGroup 