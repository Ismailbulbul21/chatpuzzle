# PuzzleChat - Dynamic Quiz App

A React application that generates dynamic quiz questions using AI and matches users based on their responses.

## Features

- Dynamic AI-generated quiz questions using Gemini API
- Different quiz questions each time
- Fallback to database questions if API is unavailable
- User matching based on quiz responses
- Real-time group chat with other matched users
- Voice calling capability
- Image/media sharing

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
4. Fill in your API keys and Supabase configuration in the `.env` file
5. Start the development server:
   ```bash
   npm run dev
   ```

## Environment Variables

- `REACT_APP_GEMINI_API_KEY`: Your OpenRouter Gemini API key
- `REACT_APP_SUPABASE_URL`: Your Supabase project URL
- `REACT_APP_SUPABASE_ANON_KEY`: Your Supabase anonymous key

## Deployment

### GitHub Pages

1. Update `package.json` with your GitHub repository:
   ```json
   "homepage": "https://yourusername.github.io/your-repo-name",
   ```
2. Install GitHub Pages dependency:
   ```bash
   npm install --save-dev gh-pages
   ```
3. Add deployment scripts to `package.json`:
   ```json
   "scripts": {
     "predeploy": "npm run build",
     "deploy": "gh-pages -d build"
   }
   ```
4. Deploy to GitHub Pages:
   ```bash
   npm run deploy
   ```

### Vercel or Netlify

1. Connect your GitHub repository to Vercel or Netlify
2. Configure environment variables in the deployment platform
3. Deploy through the platform's dashboard

## Technology Stack

- React
- Supabase (Authentication, Database, Storage, Realtime)
- OpenRouter/Gemini API
- WebRTC (Voice Calling)
- Tailwind CSS
