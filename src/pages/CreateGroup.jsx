import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const CreateGroup = () => {
  const navigate = useNavigate()
  const [groupName, setGroupName] = useState('')
  const [groupDescription, setGroupDescription] = useState('')
  const [questions, setQuestions] = useState([
    { question: '', options: ['', '', '', ''], correctAnswer: 0 }
  ])
  const [minCorrectAnswers, setMinCorrectAnswers] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)
    }
    getUser()
  }, [])

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      { question: '', options: ['', '', '', ''], correctAnswer: 0 }
    ])
  }

  const handleRemoveQuestion = (index) => {
    if (questions.length > 1) {
      const newQuestions = questions.filter((_, i) => i !== index);
      setQuestions(newQuestions);
      
      // Ensure minCorrectAnswers is not greater than the new questions length
      if (minCorrectAnswers > newQuestions.length) {
        setMinCorrectAnswers(newQuestions.length);
      }
    }
  }

  const handleQuestionChange = (index, field, value) => {
    const newQuestions = [...questions]
    if (field === 'option') {
      const [optionIndex, optionValue] = value
      newQuestions[index].options[optionIndex] = optionValue
    } else if (field === 'correctAnswer') {
      newQuestions[index].correctAnswer = parseInt(value, 10)
    } else {
      newQuestions[index][field] = value
    }
    setQuestions(newQuestions)
  }

  const handleMinCorrectAnswersChange = (e) => {
    const value = parseInt(e.target.value, 10);
    setMinCorrectAnswers(isNaN(value) ? 1 : Math.max(1, Math.min(value, questions.length)));
  }

  const validateForm = () => {
    if (!groupName.trim()) {
      setError('Group name is required')
      return false
    }

    if (questions.length < 2) {
      setError('You must create at least 2 questions')
      return false
    }

    for (const question of questions) {
      if (!question.question.trim()) {
        setError('All questions must have content')
        return false
      }

      for (const option of question.options) {
        if (!option.trim()) {
          setError('All question options must have content')
          return false
        }
      }
    }

    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Create the group
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: groupName,
          description: groupDescription,
          created_by: currentUser.id,
          min_correct_answers: minCorrectAnswers,
          total_questions: questions.length
        })
        .select()
        .single()

      if (groupError) throw groupError

      // Add current user as admin
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: groupData.id,
          user_id: currentUser.id,
          is_admin: true
        })

      if (memberError) throw memberError

      // Save questions
      const questionsToSave = questions.map(q => ({
        group_id: groupData.id,
        question: q.question,
        options: q.options,
        correct_answer: q.correctAnswer,
        is_active: true
      }))

      const { error: questionError } = await supabase
        .from('group_puzzles')
        .insert(questionsToSave)

      if (questionError) throw questionError

      // Redirect to group chat
      navigate(`/chat/${groupData.id}`)
    } catch (error) {
      console.error('Error creating group:', error)
      setError('An error occurred while creating the group')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold mb-6">Create a New Group</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Group Details</h2>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Group Name</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                required
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Group Description</label>
              <textarea
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                rows="3"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">
                Minimum Correct Answers Required to Join (out of {questions.length})
              </label>
              <input
                type="number"
                min="1"
                max={questions.length}
                value={minCorrectAnswers}
                onChange={handleMinCorrectAnswersChange}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          </div>
          
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Puzzle Questions</h2>
              <button
                type="button"
                onClick={handleAddQuestion}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Add Question
              </button>
            </div>
            
            <p className="text-gray-600 mb-4">
              Create at least 2 questions. Users must answer at least {minCorrectAnswers} questions correctly to join the group.
            </p>
            
            {questions.map((question, index) => (
              <div key={index} className="mb-8 p-4 border rounded-md bg-gray-50">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium">Question {index + 1}</h3>
                  <button
                    type="button"
                    onClick={() => handleRemoveQuestion(index)}
                    className="text-red-500 hover:text-red-700"
                    disabled={questions.length <= 1}
                  >
                    Remove
                  </button>
                </div>
                
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Question</label>
                  <input
                    type="text"
                    value={question.question}
                    onChange={(e) => handleQuestionChange(index, 'question', e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Options</label>
                  {question.options.map((option, optionIndex) => (
                    <div key={optionIndex} className="flex items-center mb-2">
                      <input
                        type="radio"
                        name={`correct-answer-${index}`}
                        checked={question.correctAnswer === optionIndex}
                        onChange={() => handleQuestionChange(index, 'correctAnswer', optionIndex)}
                        className="mr-2"
                      />
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => handleQuestionChange(index, 'option', [optionIndex, e.target.value])}
                        className="w-full px-3 py-2 border rounded-md"
                        placeholder={`Option ${optionIndex + 1}`}
                        required
                      />
                    </div>
                  ))}
                  <p className="text-sm text-gray-500 mt-1">
                    Select the radio button next to the correct answer
                  </p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  )
}

export default CreateGroup 