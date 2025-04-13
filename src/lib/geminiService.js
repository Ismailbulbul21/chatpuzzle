// API service for Gemini model through OpenRouter
import {
    GEMINI_API_KEY,
    OPEN_ROUTER_API_URL,
    DEFAULT_MODEL,
    PUZZLE_CATEGORIES,
    DEFAULT_PUZZLE_COUNT
} from './config';

/**
 * Generate dynamic quiz questions based on categories
 * @param {Array} categories - Array of desired question categories
 * @param {number} count - Number of questions to generate
 * @returns {Promise<Array>} Array of question objects
 */
export const generateQuizQuestions = async (
    categories = PUZZLE_CATEGORIES,
    count = DEFAULT_PUZZLE_COUNT
) => {
    try {
        const prompt = `Generate ${count} unique quiz questions in Somali language about the following categories: ${categories.join(', ')}.
    
    Each question should follow this format:
    1. For multiple choice questions:
    {
      "category": "category name",
      "question": "The question text in Somali",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"]
    }
    
    2. For open-ended questions:
    {
      "category": "category name",
      "question": "The question text in Somali",
      "options": null
    }
    
    Make about 70% multiple choice and 30% open-ended.
    Return ONLY valid JSON array of questions without any additional text.`;

        const response = await fetch(OPEN_ROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GEMINI_API_KEY}`,
            },
            body: JSON.stringify({
                model: DEFAULT_MODEL,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 4096,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const rawText = data.choices[0].message.content;

        // Extract JSON array from the response
        const jsonMatch = rawText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            throw new Error('Could not extract valid JSON from API response');
        }

        const questions = JSON.parse(jsonMatch[0]);
        return questions;
    } catch (error) {
        console.error('Error generating quiz questions:', error);
        throw error;
    }
}; 