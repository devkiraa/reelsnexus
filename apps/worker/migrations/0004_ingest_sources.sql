-- Migration to support Multi-Source Ingestion (Google Drive & MEGA)
-- Adds columns to track where the raw video originated.

ALTER TABLE render_jobs ADD COLUMN source_type TEXT NOT NULL DEFAULT 'gdrive';
ALTER TABLE render_jobs ADD COLUMN source_url TEXT;
ALTER TABLE render_jobs ADD COLUMN source_file_id TEXT;
ALTER TABLE render_jobs ADD COLUMN file_size INTEGER DEFAULT 0;

-- Backfill source_file_id with the existing raw_drive_id for historical jobs
UPDATE render_jobs SET source_file_id = raw_drive_id WHERE source_file_id IS NULL;
