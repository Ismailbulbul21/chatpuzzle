import { createClient } from '@supabase/supabase-js';

// Primary Supabase URL and key from environment variables
const primaryUrl = import.meta.env.VITE_REACT_APP_SUPABASE_URL || 'https://pivkzwnrinlrwvdqigra.supabase.co';
const primaryKey = import.meta.env.VITE_REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpdmt6d25yaW5scnd2ZHFpZ3JhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ1NjgxMDIsImV4cCI6MjA2MDE0NDEwMn0.qjQyaIu89H-6mOkEnBvT-5iIhqAL4uDJZlN-OyY0UkM';

// Secondary URL that might be used in some MCP tools
const secondaryUrl = 'https://tsjnwqalfgxiwficbgsp.supabase.co';
// You would need to add the proper anon key for this secondary URL

// Use primary URL by default
const supabaseUrl = primaryUrl;
const supabaseAnonKey = primaryKey;

console.log('Creating Supabase client with URL:', supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        detectSessionInUrl: true
    }
});

// Helper for debugging database calls
export const logDbOperation = (operation, table, data, error) => {
    if (error) {
        console.error(`DB ERROR - ${operation} on ${table}:`, error);
        return;
    }

    console.log(`DB SUCCESS - ${operation} on ${table}:`, data);
};

// Function to check if a group has questions and fix it if needed
export const ensureGroupHasQuestions = async (groupId) => {
    if (!groupId) return false;

    // First check if the group exists
    const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

    if (groupError || !group) {
        console.error('Group not found:', groupId);
        return false;
    }

    // Check if the group has questions
    const { data: questions, error: questionsError } = await supabase
        .from('group_puzzles')
        .select('id')
        .eq('group_id', groupId)
        .eq('is_active', true);

    if (questionsError) {
        console.error('Error checking questions:', questionsError);
        return false;
    }

    // If the group has no questions, return false instead of adding default ones
    if (!questions || questions.length === 0) {
        console.log(`Group ${groupId} has no questions`);
        return false;
    }

    return true;
}; 