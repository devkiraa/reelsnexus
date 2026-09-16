ALTER TABLE channels ADD COLUMN channel_handle TEXT;
ALTER TABLE channels ADD COLUMN avatar_url TEXT;
ALTER TABLE channels ADD COLUMN subscriber_count INTEGER DEFAULT 0;
