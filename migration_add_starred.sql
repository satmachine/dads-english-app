-- Run this in your Supabase SQL Editor to update your existing table
ALTER TABLE card_progress ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE;
ALTER TABLE card_progress ADD COLUMN IF NOT EXISTS starred_at TIMESTAMP WITH TIME ZONE;
