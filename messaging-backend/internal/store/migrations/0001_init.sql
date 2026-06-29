-- Phase 1 messaging schema. Body columns are opaque text (E2EE-ready).

CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar_url   TEXT,
  role         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversations (
  id         UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id  UUID NOT NULL REFERENCES conversations(id),
  user_id          UUID NOT NULL REFERENCES users(id),
  last_read_msg_id UUID,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS channels (
  id         UUID PRIMARY KEY,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'hangout',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS channel_members (
  channel_id       UUID NOT NULL REFERENCES channels(id),
  user_id          UUID NOT NULL REFERENCES users(id),
  last_read_msg_id UUID,
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  channel_id      UUID REFERENCES channels(id),
  sender_id       UUID NOT NULL REFERENCES users(id),
  client_msg_id   TEXT,
  type            TEXT NOT NULL DEFAULT 'text',
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((conversation_id IS NULL) <> (channel_id IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id, id);
CREATE INDEX IF NOT EXISTS idx_messages_channel      ON messages (channel_id, id);
-- dedup: a sender cannot create two messages with the same clientMsgId in a convo
CREATE UNIQUE INDEX IF NOT EXISTS uq_messages_client
  ON messages (conversation_id, sender_id, client_msg_id)
  WHERE client_msg_id IS NOT NULL AND conversation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS message_receipts (
  message_id UUID NOT NULL REFERENCES messages(id),
  user_id    UUID NOT NULL REFERENCES users(id),
  state      TEXT NOT NULL DEFAULT 'sent',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS posts (
  id         UUID PRIMARY KEY,
  author_id  UUID NOT NULL REFERENCES users(id),
  kind       TEXT NOT NULL DEFAULT 'update',
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts (created_at DESC);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id UUID NOT NULL REFERENCES posts(id),
  user_id UUID NOT NULL REFERENCES users(id),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_comments (
  id         UUID PRIMARY KEY,
  post_id    UUID NOT NULL REFERENCES posts(id),
  author_id  UUID NOT NULL REFERENCES users(id),
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
