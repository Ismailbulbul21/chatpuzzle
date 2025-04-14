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
        console.log("Generating quiz questions with API key:", GEMINI_API_KEY ? `${GEMINI_API_KEY.substring(0, 8)}...` : "API key is missing");

        // Remove any spaces in the API key that might cause auth errors
        const cleanApiKey = GEMINI_API_KEY.trim();

        if (!cleanApiKey) {
            throw new Error('API key is missing or empty');
        }

        // Choose a random subset of categories to ensure variety
        const shuffledCategories = [...categories].sort(() => 0.5 - Math.random());
        const selectedCategories = shuffledCategories.slice(0, Math.min(6, categories.length));

        const prompt = `Generate ${count} unique, creative, and engaging quiz questions in Somali language about the following categories: ${selectedCategories.join(', ')}.

IMPORTANT INSTRUCTIONS:
1. Make questions diverse and fun - avoid repetitive themes
2. Include both factual and opinion-based questions
3. Make questions culturally relevant to Somalia and East Africa
4. Mix easy and challenging questions
5. Include at least one question that encourages personal expression
6. For multiple choice questions, make options thoughtful and occasionally humorous
7. For open-ended questions, design them to reveal personality traits

Each question should follow this format:
1. For multiple choice questions (about 70% of questions):
{
  "category": "category name",
  "question": "The question text in Somali",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"]
}
    
2. For open-ended questions (about 30% of questions):
{
  "category": "category name",
  "question": "The question text in Somali",
  "options": null
}
    
Return ONLY valid JSON array of questions without any additional text.`;

        console.log(`Making request to OpenRouter API with model ${DEFAULT_MODEL}`);

        try {
            const response = await fetch(OPEN_ROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cleanApiKey}`,
                    'HTTP-Referer': window.location.origin || 'https://puzzlechat.app',
                    'X-Title': 'PuzzleChat'
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
                    temperature: 0.8
                })
            });

            if (!response.ok) {
                const errorData = await response.text();
                console.error('API error response:', errorData);
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log("API response received successfully");

            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                console.error('Unexpected API response format:', data);
                throw new Error('Unexpected API response format');
            }

            const rawText = data.choices[0].message.content;

            // Extract JSON array from the response
            const jsonMatch = rawText.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                console.error('Could not extract JSON from:', rawText);
                throw new Error('Could not extract valid JSON from API response');
            }

            try {
                const questions = JSON.parse(jsonMatch[0]);
                return questions;
            } catch (parseError) {
                console.error('JSON parsing error:', parseError, 'for text:', jsonMatch[0]);
                throw new Error('Failed to parse API response as JSON');
            }
        } catch (apiError) {
            console.error('API request failed, using fallback questions:', apiError);
            // Fallback to sample questions if API call fails
            const sampleQuestions = [
                {
                    category: "history",
                    question: "Goorma ayaa la aasaasay Soomaaliya?",
                    options: ["1960", "1950", "1970", "1980"]
                },
                {
                    category: "poetry",
                    question: "Ma sheegi kartaa nooca gabayga caanka ah ee Soomaalida?",
                    options: null
                },
                {
                    category: "food",
                    question: "Canjeero waxaa inta badan lagu cunaa?",
                    options: ["Quraac", "Casho", "Qado", "Dhamaan wakhtiyada"]
                },
                {
                    category: "travel",
                    question: "Magaalada ugu weyn Soomaaliya waa?",
                    options: ["Muqdisho", "Hargeysa", "Kismaayo", "Boosaaso"]
                },
                {
                    category: "humor",
                    question: "Sheeko-xariirooyin Soomaaliyeed maxay inta badan ka hadlaan?",
                    options: null
                },
                {
                    category: "sports",
                    question: "Ciyaarta ugu caansan Soomaaliya waa?",
                    options: ["Kubadda Cagta", "Orodka", "Kubadda Kolayga", "Dabaasha"]
                },
                {
                    category: "technology",
                    question: "Shirkadda telefoonada gacanta ee ugu caansan Soomaaliya?",
                    options: ["Hormuud", "Somtel", "Telesom", "Golis"]
                },
                {
                    category: "culture",
                    question: "Maxaa kuu muhiimsan dhaqanka Soomaalida?",
                    options: null
                }
            ];

            console.log("Generated fallback sample questions:", sampleQuestions.length);
            return sampleQuestions;
        }
    } catch (error) {
        console.error('Error generating quiz questions:', error);
        throw error;
    }
}; 