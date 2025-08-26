CREATE TABLE upload_sessions (
  id BIGSERIAL PRIMARY KEY,
  upload_id TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  total_chunks INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'initiated', -- initiated, processing, completed, failed
  result_data JSONB,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE upload_chunks (
  id BIGSERIAL PRIMARY KEY,
  upload_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_path TEXT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(upload_id, chunk_index)
);

CREATE INDEX idx_upload_sessions_upload_id ON upload_sessions(upload_id);
CREATE INDEX idx_upload_sessions_session_id ON upload_sessions(session_id);
CREATE INDEX idx_upload_chunks_upload_id ON upload_chunks(upload_id);
