// Configuration variables for the application

// OpenRouter API key for Gemini
// Using environment variable or fallback to empty string (for development only)
export const GEMINI_API_KEY = import.meta.env.VITE_REACT_APP_GEMINI_API_KEY || '';
console.log("Environment variable check:", import.meta.env.VITE_REACT_APP_GEMINI_API_KEY ? "API key is set" : "API key is missing");

// OpenRouter API URL
export const OPEN_ROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Default model to use - use the correct model ID from OpenRouter
export const DEFAULT_MODEL = 'google/gemini-2.5-pro-exp-03-25:free';

// Puzzle categories
export const PUZZLE_CATEGORIES = [
    'history',
    'poetry',
    'food',
    'travel',
    'humor',
    'sports',
    'technology',
    'music',
    'culture',
    'science',
    'art',
    'geography',
    'traditions',
    'literature',
    'nature'
];

// Number of puzzles to generate
export const DEFAULT_PUZZLE_COUNT = 8;