-- Add Google OAuth profile fields to users table
ALTER TABLE users ADD COLUMN name TEXT;
ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN google_id TEXT;
