# Dad's English App

A spaced-repetition flashcard web app for learning English with audio playback and cloud-synced progress.

## Architecture

| Component | Storage Location |
|-----------|------------------|
| Flashcard content (questions, answers, audio) | GitHub (`content/` folder) |
| Learning progress (intervals, review dates) | Supabase (`card_progress` table) |
| User authentication | Supabase Auth |

## Features

### Spaced Repetition
Uses a simplified SM-2 algorithm to schedule card reviews. After viewing a card, rate it as **Easy** or **Hard**:
- **Easy**: Card interval increases (1 day → 3 days → grows with ease factor)
- **Hard**: Card resets to 1-day interval

### Two Modes

**Test** - Review cards that are due. Audio auto-plays and loops. Rate each card to schedule the next review.

**Study** - Browse all cards freely. Click any card to view it. Audio auto-advances to the next card when finished.

### Audio Playback Controls
- Play/Pause toggle
- Rewind 5 seconds
- Restart from beginning
- Speed toggle (1x / 1.2x)

## Adding Flashcards

Cards are stored in the `content/` folder and managed via Git commits.

### Step 1: Prepare Source Files

Create a folder with your audio and text files:

```
/your-source-folder/
  lesson001.mp3
  lesson001.txt     ← Line 1: English text, Lines 2+: Chinese translation
  lesson002.mp3
  lesson002.txt
  ...
```

**Text file format:**
```
This is the English paragraph that will be displayed as the question.
這是會顯示為答案的中文翻譯。
可以有多行。
```

### Step 2: Generate Cards

```bash
cd scripts/
node generate-cards.mjs /path/to/your/source/folder
```

This will:
- Copy audio files to `content/audio/`
- Generate `content/cards.json` with card definitions

### Step 3: Commit and Push

```bash
git add content/
git commit -m "Add new flashcards"
git push
```

The app will automatically load the new cards.

## Content Structure

```
content/
  audio/
    lesson001.mp3
    lesson002.mp3
    ...
  cards.json        ← Card definitions
```

**cards.json format:**
```json
{
  "cards": [
    {
      "id": "lesson001",
      "question": "English paragraph text...",
      "answer": "Chinese translation...",
      "audioFile": "lesson001.mp3"
    }
  ]
}
```

## Tech Stack

- Vanilla JavaScript (no framework)
- Supabase (authentication, progress storage)
- GitHub (card content and audio hosting)

## Setup

### 1. Supabase Configuration

Create a Supabase project at [supabase.com](https://supabase.com) and update `config.js`:

```js
const SUPABASE_CONFIG = {
  url: 'https://your-project.supabase.co',
  anonKey: 'your-anon-key'
};
```

### 2. Database Schema

Run in Supabase SQL Editor:

```sql
-- Card progress table (stores learning progress only)
CREATE TABLE card_progress (
  card_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interval INTEGER DEFAULT 0,
  repetitions INTEGER DEFAULT 0,
  ease_factor NUMERIC(3,2) DEFAULT 2.50,
  next_review BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (card_id, user_id)
);

-- User settings table
CREATE TABLE user_settings (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  openai_api_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE card_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own progress" ON card_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON card_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON card_progress FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own settings" ON user_settings FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own settings" ON user_settings FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own settings" ON user_settings FOR UPDATE USING (auth.uid() = id);
```

### 3. Deploy

Serve the files with any static file server, or deploy to GitHub Pages.
