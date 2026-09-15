CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE channels (
    id TEXT PRIMARY KEY,
    channel_name TEXT NOT NULL,
    niche TEXT NOT NULL,
    watermark_url TEXT,
    watermark_position TEXT DEFAULT 'bottom-right',
    watermark_opacity REAL DEFAULT 1.0,
    target_drive_folder_id TEXT,
    youtube_refresh_token TEXT,
    daily_quota_used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE render_jobs (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    raw_drive_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    processed_drive_id TEXT,
    frame_drive_id TEXT,
    trending_keywords TEXT,
    ai_title TEXT,
    ai_hook TEXT,
    ai_description TEXT,
    ai_tags TEXT,
    scheduled_at DATETIME,
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (channel_id) REFERENCES channels(id)
);
