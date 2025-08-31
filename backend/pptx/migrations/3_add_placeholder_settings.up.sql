ALTER TABLE sessions ADD COLUMN placeholder_settings JSONB DEFAULT '{}';

CREATE INDEX idx_sessions_placeholder_settings ON sessions USING GIN (placeholder_settings);
