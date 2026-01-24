-- Dad's English App - Supabase Database Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User Settings Table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  openai_api_key TEXT, -- Encrypted API key
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cards Table
CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  audio_url TEXT, -- URL to Supabase Storage
  interval INTEGER DEFAULT 0,
  repetitions INTEGER DEFAULT 0,
  ease_factor NUMERIC(3,2) DEFAULT 2.50,
  next_review BIGINT, -- timestamp in milliseconds
  pinned BOOLEAN DEFAULT FALSE,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cards_user_id ON cards(user_id);
CREATE INDEX IF NOT EXISTS idx_cards_next_review ON cards(user_id, next_review);
CREATE INDEX IF NOT EXISTS idx_cards_user_order ON cards(user_id, order_index);

-- Enable Row Level Security (RLS)
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_settings
-- Users can only read their own settings
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = id);

-- Users can insert their own settings
CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own settings
CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for cards
-- Users can only view their own cards
CREATE POLICY "Users can view own cards"
  ON cards FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own cards
CREATE POLICY "Users can insert own cards"
  ON cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own cards
CREATE POLICY "Users can update own cards"
  ON cards FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own cards
CREATE POLICY "Users can delete own cards"
  ON cards FOR DELETE
  USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on user_settings
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at on cards
CREATE TRIGGER update_cards_updated_at
  BEFORE UPDATE ON cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-files', 'audio-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: Users can upload their own audio files
CREATE POLICY "Users can upload own audio files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'audio-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policy: Users can view their own audio files (and public access for playback)
CREATE POLICY "Audio files are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'audio-files');

-- Storage policy: Users can delete their own audio files
CREATE POLICY "Users can delete own audio files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'audio-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
