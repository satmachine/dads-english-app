-- Dad's English App - Supabase Database Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql
--
-- Architecture: Cards are stored in GitHub (content/cards.json), only progress is stored in Supabase.

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User Settings Table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  openai_api_key TEXT, -- Encrypted API key (kept for potential future use)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Card Progress Table (stores spaced repetition progress for GitHub-hosted cards)
CREATE TABLE IF NOT EXISTS card_progress (
  card_id TEXT NOT NULL,  -- matches id from content/cards.json
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interval INTEGER DEFAULT 0,
  repetitions INTEGER DEFAULT 0,
  ease_factor NUMERIC(3,2) DEFAULT 2.50,
  next_review BIGINT,  -- timestamp in milliseconds
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (card_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_card_progress_user_id ON card_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_card_progress_next_review ON card_progress(user_id, next_review);

-- Enable Row Level Security (RLS)
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_progress ENABLE ROW LEVEL SECURITY;

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

-- RLS Policies for card_progress
-- Users can only view their own progress
CREATE POLICY "Users can view own progress"
  ON card_progress FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own progress
CREATE POLICY "Users can insert own progress"
  ON card_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own progress
CREATE POLICY "Users can update own progress"
  ON card_progress FOR UPDATE
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

-- Trigger to update updated_at on card_progress
CREATE TRIGGER update_card_progress_updated_at
  BEFORE UPDATE ON card_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
