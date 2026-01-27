// Supabase Configuration
// Replace these values with your Supabase project credentials
// Get these from: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api

const SUPABASE_CONFIG = {
  url: 'YOUR_SUPABASE_URL', // e.g., 'https://xxxxx.supabase.co'
  anonKey: 'YOUR_SUPABASE_ANON_KEY' // Your anon/public key
};

// Export for use in app.js
window.SUPABASE_CONFIG = SUPABASE_CONFIG;
