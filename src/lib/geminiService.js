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
        const selectedCategories = shuffledCategories.slice(0, Math.min(count, categories.length));

        const prompt = `Generate ${count} unique, creative, and engaging MULTIPLE CHOICE quiz questions in Somali language.

IMPORTANT INSTRUCTIONS:
1. ONLY create multiple choice questions with 4 options each
2. DO NOT create any open-ended questions
3. Select ${selectedCategories.length} different categories from this list: ${selectedCategories.join(', ')}
4. Make sure each question is from a different category to maximize diversity
5. Make questions culturally relevant to Somalia and East Africa
6. Mix easy and challenging questions
7. Make options thoughtful and occasionally humorous
8. Questions should be factual with a clear correct answer
9. Never repeat question patterns or formats

Each question MUST follow this exact format:
{
  "category": "category name",
  "question": "The question text in Somali",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"]
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
                    temperature: 0.9
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

                // Verify all questions are multiple choice
                const validQuestions = questions.filter(q =>
                    q.options && Array.isArray(q.options) && q.options.length === 4
                );

                if (validQuestions.length < questions.length) {
                    console.warn(`Filtered out ${questions.length - validQuestions.length} non-multiple choice questions`);
                }

                return validQuestions.length > 0 ? validQuestions : generateFallbackQuestions(count);
            } catch (parseError) {
                console.error('JSON parsing error:', parseError, 'for text:', jsonMatch[0]);
                throw new Error('Failed to parse API response as JSON');
            }
        } catch (apiError) {
            console.error('API request failed, using fallback questions:', apiError);
            return generateFallbackQuestions(count);
        }
    } catch (error) {
        console.error('Error generating quiz questions:', error);
        throw error;
    }
};

/**
 * Generate fallback questions if the API fails
 * @param {number} count - Number of questions to generate
 * @returns {Array} Array of question objects
 */
const generateFallbackQuestions = (count) => {
    const fallbackQuestions = [
        {
            category: "history",
            question: "Goorma ayaa la aasaasay Soomaaliya?",
            options: ["1960", "1950", "1970", "1980"]
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
            category: "music",
            question: "Heesaha Soomaalida ugu badan waa kuwa?",
            options: ["Jacayl", "Wadaniyad", "Farxad", "Murugada"]
        },
        {
            category: "culture",
            question: "Dharka Soomaalida dumarka caanka ah?",
            options: ["Dirac", "Guntiino", "Garbasaar", "Dhammaan"]
        },
        {
            category: "geography",
            question: "Webiga ugu dheer Soomaaliya?",
            options: ["Jubba", "Shabeelle", "Nugaal", "Darod"]
        },
        {
            category: "science",
            question: "Duufaanta ugu xooggan ee soo marta Soomaaliya waxay ka timaadaa?",
            options: ["Badda Carabta", "Badda Cas", "Badda Hindiya", "Gacanka Cadmeed"]
        },
        {
            category: "literature",
            question: "Qoraaga ugu caansan Soomaalida?",
            options: ["Nuruddin Farah", "Maxamed Daahir Afrax", "Cabdalla Xaaji", "Maxamed Ibrahim Warsame"]
        }
    ];

    // Shuffle the questions to get random ones
    const shuffled = [...fallbackQuestions].sort(() => 0.5 - Math.random());

    // Return requested number of questions, or all if less than requested
    return shuffled.slice(0, Math.min(count, fallbackQuestions.length));
}; 