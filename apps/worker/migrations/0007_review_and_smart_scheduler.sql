ALTER TABLE channels ADD COLUMN daily_ai_requests INTEGER DEFAULT 0;
ALTER TABLE channels ADD COLUMN last_ai_request_date TEXT DEFAULT '';
ALTER TABLE channels ADD COLUMN target_timezone TEXT DEFAULT 'UTC';
ALTER TABLE channels ADD COLUMN contact_email TEXT DEFAULT '';

ALTER TABLE render_jobs ADD COLUMN is_reviewed INTEGER DEFAULT 0;
ALTER TABLE render_jobs ADD COLUMN approved_at DATETIME;
ALTER TABLE render_jobs ADD COLUMN scheduled_slot DATETIME;
