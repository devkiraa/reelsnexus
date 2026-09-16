ALTER TABLE channels ADD COLUMN watermark_type TEXT DEFAULT 'text';
ALTER TABLE channels ADD COLUMN watermark_x REAL DEFAULT 0.065;
ALTER TABLE channels ADD COLUMN watermark_y REAL DEFAULT 0.145;
ALTER TABLE channels ADD COLUMN watermark_font_size INTEGER DEFAULT 36;
ALTER TABLE channels ADD COLUMN watermark_font_color TEXT DEFAULT '#FFFFFF';
ALTER TABLE channels ADD COLUMN watermark_bg_enabled INTEGER DEFAULT 1;
ALTER TABLE channels ADD COLUMN watermark_bg_color TEXT DEFAULT '#000000';
ALTER TABLE channels ADD COLUMN watermark_bg_opacity REAL DEFAULT 0.40;
