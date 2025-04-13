import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pivkzwnrinlrwvdqigra.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpdmt6d25yaW5scnd2ZHFpZ3JhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ1NjgxMDIsImV4cCI6MjA2MDE0NDEwMn0.qjQyaIu89H-6mOkEnBvT-5iIhqAL4uDJZlN-OyY0UkM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey); 