-- CORVINA PostgreSQL Schema
-- Initialized automatically on first container start

CREATE TABLE IF NOT EXISTS documents (
    id            SERIAL PRIMARY KEY,
    document_id   TEXT UNIQUE NOT NULL,
    image_file    TEXT NOT NULL,
    drawing_type  TEXT DEFAULT 'handwritten',
    source        TEXT DEFAULT 'notebook',
    created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS components (
    id          TEXT NOT NULL,
    document_id TEXT NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    label       TEXT,
    bbox        INT[],
    PRIMARY KEY (document_id, id)
);

CREATE TABLE IF NOT EXISTS nodes (
    id          TEXT NOT NULL,
    document_id TEXT NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    position    INT[],
    PRIMARY KEY (document_id, id)
);

CREATE TABLE IF NOT EXISTS connections (
    id          TEXT NOT NULL,
    document_id TEXT NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    source_id   TEXT,
    target_id   TEXT,
    type        TEXT,
    points      JSONB,
    PRIMARY KEY (document_id, id)
);

CREATE TABLE IF NOT EXISTS text_annotations (
    id          TEXT NOT NULL,
    document_id TEXT NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    bbox        INT[],
    raw_text    TEXT,
    is_ignored  BOOLEAN DEFAULT false,
    linked_to   TEXT,
    label_name  TEXT,
    values      JSONB,
    PRIMARY KEY (document_id, id)
);

-- Index for fast document lookups
CREATE INDEX IF NOT EXISTS idx_components_doc ON components(document_id);
CREATE INDEX IF NOT EXISTS idx_nodes_doc ON nodes(document_id);
CREATE INDEX IF NOT EXISTS idx_connections_doc ON connections(document_id);
CREATE INDEX IF NOT EXISTS idx_text_annotations_doc ON text_annotations(document_id);
