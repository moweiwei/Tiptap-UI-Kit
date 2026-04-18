CREATE TABLE IF NOT EXISTS document (
  id            VARCHAR(64) PRIMARY KEY,
  title         VARCHAR(255) NOT NULL DEFAULT '未命名文档',
  owner_id      VARCHAR(64),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_version (
  id          SERIAL PRIMARY KEY,
  doc_id      VARCHAR(64) NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  snapshot    BYTEA NOT NULL,
  created_by  VARCHAR(64),
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_version_doc_id ON document_version(doc_id);
CREATE INDEX IF NOT EXISTS idx_version_doc_created ON document_version(doc_id, created_at DESC);

CREATE TABLE IF NOT EXISTS document_permission (
  id         SERIAL PRIMARY KEY,
  doc_id     VARCHAR(64) NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  user_id    VARCHAR(64) NOT NULL,
  role       VARCHAR(16) NOT NULL DEFAULT 'editor',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permission_doc_user ON document_permission(doc_id, user_id);
