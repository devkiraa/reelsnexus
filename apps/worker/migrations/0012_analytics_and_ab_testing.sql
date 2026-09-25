CREATE TABLE video_metrics (
    id TEXT PRIMARY KEY,
    render_job_id TEXT NOT NULL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    retention_rate REAL DEFAULT 0.0,
    ctr REAL DEFAULT 0.0,
    FOREIGN KEY (render_job_id) REFERENCES render_jobs(id)
);

ALTER TABLE render_jobs ADD COLUMN ai_title_variants TEXT;
ALTER TABLE render_jobs ADD COLUMN active_title_index INTEGER DEFAULT 0;

ALTER TABLE channels ADD COLUMN peak_engagement_hours TEXT;
