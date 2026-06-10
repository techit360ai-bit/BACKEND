-- Channel-message dedup backstop. Mirrors uq_messages_client (which is
-- conversation-only) for channel messages, so a concurrent duplicate send with
-- the same (channel_id, sender_id, client_msg_id) cannot double-insert. The
-- service's ExistsByClientMsgID check is the graceful fast path; this index is
-- the correctness guarantee for the concurrent case.
CREATE UNIQUE INDEX IF NOT EXISTS uq_messages_client_channel
  ON messages (channel_id, sender_id, client_msg_id)
  WHERE client_msg_id IS NOT NULL AND channel_id IS NOT NULL;
