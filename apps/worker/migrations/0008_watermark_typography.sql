ALTER TABLE channels ADD COLUMN watermark_font_family TEXT DEFAULT 'Inter';
ALTER TABLE channels ADD COLUMN watermark_border_radius INTEGER DEFAULT 4;
ALTER TABLE channels ADD COLUMN watermark_padding INTEGER DEFAULT 4;
