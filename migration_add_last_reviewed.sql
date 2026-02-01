-- Migration: Add last_reviewed column to card_progress table
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql
--
-- This column tracks when a card was last viewed/reviewed by the user,
-- enabling the "Recent" feature to show recently played cards.

-- Add the last_reviewed column (stores timestamp in milliseconds, same as next_review)
ALTER TABLE card_progress ADD COLUMN IF NOT EXISTS last_reviewed BIGINT;

-- Add index for efficient querying of recent cards by user
CREATE INDEX IF NOT EXISTS idx_card_progress_last_reviewed ON card_progress(user_id, last_reviewed);
