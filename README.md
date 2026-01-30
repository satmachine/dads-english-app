# Dad's English App

A spaced-repetition flashcard web app for learning English, with AI-powered content generation and cloud sync.

## Features

### Spaced Repetition
Uses a simplified SM-2 algorithm to schedule card reviews. After viewing a card, rate it as **Easy** or **Hard**:
- **Easy**: Card interval increases (1 day -> 3 days -> grows with ease factor)
- **Hard**: Card resets to 1-day interval

### Three Modes

**Test** - Review cards that are due. Audio auto-plays and loops. Rate each card to schedule the next review.

**Study** - Browse all cards freely. Click any card to view it. Audio auto-advances to the next card when finished. Drag cards to reorder, pin important ones to the top.

**Add Cards** - Create and edit flashcards with AI assistance.

### AI-Powered Card Creation
Requires an OpenAI API key (stored securely in the cloud).

- **Generate Paragraph**: Enter a topic/prompt and generate a 6-10 sentence English paragraph
- **Generate Voice**: Create text-to-speech audio using OpenAI's TTS
- **Generate Translation**: Automatically translate English text to Traditional Chinese

### Audio Playback Controls
- Play/Pause toggle
- Rewind 5 seconds
- Restart from beginning
- Speed toggle (1x / 1.2x)

### Cloud Sync
All data is stored in Supabase:
- User authentication (email/password)
- Flashcard data synced across devices
- Audio files stored in cloud storage
- OpenAI API key saved per user

## Tech Stack

- Vanilla JavaScript (no framework)
- Supabase (authentication, database, file storage)
- OpenAI API (GPT-3.5 for text, TTS for audio)

## Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Copy `config.js.example` to `config.js` and add your Supabase credentials
3. Set up the database tables (see below)
4. Serve the files with any static file server

### Database Schema

```sql
-- Cards table
create table cards (
  id uuid primary key,
  user_id uuid references auth.users(id),
  question text,
  answer text,
  audio_url text,
  interval integer default 0,
  repetitions integer default 0,
  ease_factor decimal default 2.5,
  next_review bigint,
  pinned boolean default false,
  order_index integer default 0
);

-- User settings table
create table user_settings (
  id uuid primary key references auth.users(id),
  openai_api_key text
);

-- Enable RLS
alter table cards enable row level security;
alter table user_settings enable row level security;

-- RLS policies (users can only access their own data)
create policy "Users can manage their own cards"
  on cards for all using (auth.uid() = user_id);

create policy "Users can manage their own settings"
  on user_settings for all using (auth.uid() = id);
```

### Storage Setup

Create a storage bucket called `audio-files` with public access for authenticated users.
