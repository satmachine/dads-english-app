// Supabase Configuration
// Replace these values with your Supabase project credentials
// Get these from: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api

const SUPABASE_CONFIG = {
  url: 'https://kvbcckofttjorallkqju.supabase.co', // e.g., 'https://xxxxx.supabase.co'
  anonKey: 'sb_publishable_lr80RE_aGYNNLVzVIGTWxA_Uq5MeHvr', // Your anon/public key
  // Content paths (relative to page; set contentBaseUrl if you host in a subpath, e.g. 'https://user.github.io/repo/content/audio/')
  contentBaseUrl: './content/audio/',
  cardsJsonUrl: './content/cards.json'
};

// Export for use in app.js
window.SUPABASE_CONFIG = SUPABASE_CONFIG;
