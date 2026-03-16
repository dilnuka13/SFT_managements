// c:\Users\User\Desktop\Cording\SFT\js\supabase.js
const SUPABASE_URL = 'https://yjqakonenfmoacddcbia.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqcWFrb25lbmZtb2FjZGRjYmlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NDcyNTMsImV4cCI6MjA4OTIyMzI1M30.rZTetU8UA0RWF0DT5yQQevepsJyBlDDJsPh6O5w5GWs';

window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);