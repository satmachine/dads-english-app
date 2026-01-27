# Dad's English App - Cloud Migration Setup Guide

This guide will help you set up the cloud-based version of Dad's English App with user authentication and cloud storage.

## Overview

The app has been migrated from local storage (IndexedDB) to cloud-based storage using Supabase. Key features:

✅ **User Authentication** - Secure login with email/password
✅ **Cloud Storage** - All flashcards stored in Supabase PostgreSQL database
✅ **Cloud Audio** - Audio files stored in Supabase Storage
✅ **Multi-Device Sync** - Access your cards from any device
✅ **Secure API Keys** - OpenAI API keys stored securely in the cloud
✅ **Data Migration** - Import your old cards with one click

---

## Prerequisites

1. A free Supabase account (https://supabase.com)
2. Your OpenAI API key (for generating content/audio)

---

## Setup Instructions

### Step 1: Create a Supabase Project

1. Go to https://supabase.com and sign up for a free account
2. Click **"New Project"**
3. Fill in the details:
   - **Name**: `dads-english-app` (or any name you prefer)
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose the closest region to you
4. Click **"Create new project"** and wait 2-3 minutes for setup

### Step 2: Get Your Supabase Credentials

1. In your Supabase project dashboard, click **Settings** (gear icon) in the left sidebar
2. Click **API** under "Project Settings"
3. Copy the following values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (under "Project API keys")

### Step 3: Configure the App

1. Open the `config.js` file in your app directory
2. Replace the placeholder values with your actual credentials:

```javascript
const SUPABASE_CONFIG = {
  url: 'https://your-project-id.supabase.co',  // Replace with your Project URL
  anonKey: 'your-anon-key-here'                // Replace with your anon public key
};
```

3. Save the file

### Step 4: Set Up the Database

1. In your Supabase project, click **SQL Editor** in the left sidebar
2. Click **"New query"**
3. Open the `database-schema.sql` file from your app directory
4. Copy the entire contents and paste it into the SQL Editor
5. Click **"Run"** (or press Ctrl+Enter)
6. You should see "Success. No rows returned" - this means the tables were created successfully

### Step 5: Enable Email Authentication

1. In Supabase, click **Authentication** in the left sidebar
2. Click **Providers** tab
3. Make sure **Email** is enabled (it should be by default)
4. Optional: Configure email templates under **Email Templates** tab

### Step 6: Launch the App

1. Open `index.html` in your web browser
2. You should see the login screen
3. Click **"Register"** to create your first account
4. Fill in your email and password (minimum 6 characters)
5. Check your email for a verification link (check spam folder if needed)
6. Click the verification link
7. Return to the app and login with your credentials

---

## Migrating Existing Data

If you were using the old version with IndexedDB:

### Option 1: Export and Import (Recommended)

1. **On the old version**:
   - Open the app in your browser
   - Click **"Export"** button
   - Save the JSON file to your computer

2. **On the new version**:
   - Login to your account
   - Click **"Import"** button
   - Select the JSON file you exported
   - Wait for the import to complete (audio files will be uploaded automatically)
   - All your cards are now in the cloud!

### Option 2: Browser Developer Tools (Advanced)

If you can't access the export button:

1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Paste this code:

```javascript
// Export from IndexedDB
const request = indexedDB.open('flashcards-db', 1);
request.onsuccess = () => {
  const db = request.result;
  const tx = db.transaction('cards', 'readonly');
  const store = tx.objectStore('cards');
  const req = store.getAll();
  req.onsuccess = () => {
    const json = JSON.stringify(req.result, null, 2);
    const blob = new Blob([json], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cards-backup.json';
    a.click();
  };
};
```

4. This will download a JSON file
5. Import it using the Import button in the new version

---

## Features & Usage

### User Authentication

- **Register**: Create a new account with email and password
- **Login**: Access your cards from any device
- **Logout**: Click the logout button in the top right

### Card Management

All existing features work the same:

- **Add Cards**: Create flashcards with AI-generated content
- **Study Mode**: Review cards with spaced repetition
- **Browse Mode**: View and reorder all your cards
- **Pin Cards**: Keep important cards at the top
- **Drag & Drop**: Reorder cards manually

### Cloud Sync

- All changes are automatically saved to the cloud
- Access your cards from any device by logging in
- No need to manually export/import anymore

### OpenAI API Key

- When you first use AI features, you'll be prompted for your OpenAI API key
- The key is stored securely in Supabase (not in browser storage)
- It's automatically synced across all your devices

---

## Troubleshooting

### "Supabase is not configured" Error

**Solution**: Make sure you updated `config.js` with your actual Supabase credentials

### "Failed to load cards from cloud" Error

**Solutions**:
1. Check your internet connection
2. Make sure you ran the database-schema.sql script
3. Check Supabase dashboard for any errors in the database

### Email Verification Not Received

**Solutions**:
1. Check your spam/junk folder
2. In Supabase, go to **Authentication** > **Email Templates** and verify SMTP is configured
3. For development, you can disable email verification:
   - Go to **Authentication** > **Providers** > **Email**
   - Uncheck "Confirm email"

### Audio Upload Fails

**Solutions**:
1. Check Supabase Storage bucket was created:
   - Go to **Storage** in Supabase
   - You should see a bucket called "audio-files"
2. Check storage policies were applied (they're in the SQL script)
3. Check your internet connection

### Can't Login After Registration

**Solutions**:
1. Check if email confirmation is required (check email)
2. In Supabase, go to **Authentication** > **Users** to see if your user exists
3. Try password reset if needed

---

## Security Notes

### API Keys

- Your OpenAI API key is stored in the `user_settings` table in Supabase
- It's accessible only to your authenticated user
- Consider implementing encryption for production use

### Row Level Security (RLS)

The database schema includes RLS policies that ensure:
- Users can only see their own cards
- Users can only modify their own data
- No user can access another user's information

### Best Practices

1. **Strong Passwords**: Use passwords with at least 8 characters
2. **Email Verification**: Keep this enabled for production
3. **Regular Backups**: Periodically export your cards as JSON
4. **API Key Rotation**: Rotate your OpenAI API key periodically

---

## Supabase Free Tier Limits

The free tier includes:
- ✅ 500 MB database storage
- ✅ 1 GB file storage (for audio files)
- ✅ 50,000 monthly active users
- ✅ 500 MB bandwidth per month

For a personal flashcard app, this is more than enough!

---

## Database Schema

The app uses 2 main tables:

### `cards` table
- Stores all your flashcards
- Includes question, answer, audio URL, and spaced-repetition data
- Automatically filtered by user_id

### `user_settings` table
- Stores user preferences
- Currently stores OpenAI API key
- Can be extended for more settings

### `audio-files` storage bucket
- Stores audio files as MP3
- Files are organized by user_id
- Public read access, authenticated write/delete

---

## Support & Contribution

### Common Questions

**Q: Can I use this offline?**
A: No, the cloud version requires an internet connection to load and save data.

**Q: Can I self-host this?**
A: Yes! Supabase is open-source. You can self-host your own instance.

**Q: How do I delete my account?**
A: Contact the Supabase project admin or use the Supabase dashboard to delete your user.

**Q: Is my data encrypted?**
A: Data is transmitted over HTTPS. Database encryption depends on your Supabase plan.

### Need Help?

- Check Supabase documentation: https://supabase.com/docs
- Open an issue on the project repository
- Contact the developer

---

## Next Steps

1. ✅ Complete the setup steps above
2. ✅ Test the login/registration flow
3. ✅ Import your existing cards (if any)
4. ✅ Create your first cloud-synced flashcard!
5. ✅ Access your cards from multiple devices

Enjoy your cloud-enabled English learning app! 🚀
