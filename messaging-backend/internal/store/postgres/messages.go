package postgres

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/store"
)

func bodyHash(value string) string { return fmt.Sprintf("%x", sha256.Sum256([]byte(value))) }

type MessageStore struct{ pool *pgxpool.Pool }

// InsertDM inserts the message and a 'sent' receipt for the recipient in one tx.
func (s *MessageStore) InsertDM(ctx context.Context, m store.Message, recipientID, clientMsgID string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var cmid any
	if clientMsgID != "" {
		cmid = clientMsgID
	}
	mentions, _ := json.Marshal(m.Mentions)
	if _, err := tx.Exec(ctx, `
		INSERT INTO messages (id, conversation_id, sender_id, client_msg_id, type, body, mentions, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		m.ID, m.ConversationID, m.SenderID, cmid, m.Type, m.Body, mentions, m.CreatedAt); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO message_receipts (message_id, user_id, state) VALUES ($1,$2,'sent')`, m.ID, recipientID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *MessageStore) SetReceipt(ctx context.Context, msgID, userID string, st store.ReceiptState) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO message_receipts (message_id, user_id, state, updated_at)
		VALUES ($1,$2,$3, now())
		ON CONFLICT (message_id, user_id) DO UPDATE SET state=EXCLUDED.state, updated_at=now()`,
		msgID, userID, string(st))
	return err
}

func (s *MessageStore) MessagesByConversation(ctx context.Context, convID, before string, limit int) ([]store.Message, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	q := `SELECT id, conversation_id, sender_id, type, body, mentions, created_at, edited_at, edit_version, deleted_at, COALESCE(deleted_by::text,'')
	      FROM messages WHERE conversation_id=$1`
	args := []any{convID}
	if before != "" {
		q += ` AND id < $2`
		args = append(args, before)
	}
	q += ` ORDER BY id DESC LIMIT ` + strconv.Itoa(limit)
	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []store.Message
	for rows.Next() {
		var m store.Message
		var raw []byte
		var deletedBy *string
		if err := rows.Scan(&m.ID, &m.ConversationID, &m.SenderID, &m.Type, &m.Body, &raw, &m.CreatedAt, &m.EditedAt, &m.EditVersion, &m.DeletedAt, &deletedBy); err != nil {
			return nil, err
		}
		if deletedBy != nil { m.DeletedBy = *deletedBy }
		_ = json.Unmarshal(raw, &m.Mentions)
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *MessageStore) CountByConversationSender(ctx context.Context, convID, senderID string) (int, error) {
	var count int
	err := s.pool.QueryRow(ctx, `SELECT count(*) FROM messages WHERE conversation_id=$1 AND sender_id=$2`, convID, senderID).Scan(&count)
	return count, err
}

func (s *MessageStore) ExistsByClientMsgID(ctx context.Context, convID, senderID, clientMsgID string) (string, bool, error) {
	if clientMsgID == "" {
		return "", false, nil
	}
	var id string
	err := s.pool.QueryRow(ctx, `SELECT id FROM messages WHERE conversation_id=$1 AND sender_id=$2 AND client_msg_id=$3`, convID, senderID, clientMsgID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return id, true, nil
}

// BelongsToConversation reports whether msgID is a message in convID.
func (s *MessageStore) BelongsToConversation(ctx context.Context, msgID, convID string) (bool, error) {
	var x int
	err := s.pool.QueryRow(ctx, `SELECT 1 FROM messages WHERE id=$1 AND conversation_id=$2`, msgID, convID).Scan(&x)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}

func (s *MessageStore) EditMessage(ctx context.Context, messageID, actorID, body string, expectedVersion int, now time.Time) (store.Message, error) {
	tx, err := s.pool.Begin(ctx); if err != nil { return store.Message{}, err }; defer tx.Rollback(ctx)
	var m store.Message; var raw []byte; var edited, deleted *time.Time; var version int; var deletedBy *string
	err = tx.QueryRow(ctx, `SELECT id, conversation_id, channel_id, sender_id, type, body, mentions, created_at, edited_at, edit_version, deleted_at, deleted_by FROM messages WHERE id=$1 FOR UPDATE`, messageID).Scan(&m.ID, &m.ConversationID, &m.ChannelID, &m.SenderID, &m.Type, &m.Body, &raw, &m.CreatedAt, &edited, &version, &deleted, &deletedBy)
	if errors.Is(err, pgx.ErrNoRows) { return store.Message{}, store.ErrNotFound }; if err != nil { return store.Message{}, err }; if deletedBy != nil { m.DeletedBy = *deletedBy }
	if m.SenderID != actorID { return store.Message{}, errors.New("message edit forbidden") }; if deleted != nil { return store.Message{}, errors.New("message deleted") }; if now.Sub(m.CreatedAt) > 15*time.Minute { return store.Message{}, errors.New("message edit window expired") }; if version != expectedVersion { return store.Message{}, errors.New("message version conflict") }
	if _, err = tx.Exec(ctx, `UPDATE messages SET body=$2, edited_at=$3, edit_version=edit_version+1 WHERE id=$1`, messageID, body, now); err != nil { return store.Message{}, err }
	if _, err = tx.Exec(ctx, `INSERT INTO message_mutation_audit (id,message_id,actor_id,action,previous_hash,new_hash) VALUES ($1,$2,$3,'edit',$4,$5)`, uuid.New(), messageID, actorID, bodyHash(m.Body), bodyHash(body)); err != nil { return store.Message{}, err }
	_ = json.Unmarshal(raw, &m.Mentions); m.Body = body; m.EditedAt = &now; m.EditVersion = version + 1; m.CreatedAt = m.CreatedAt; return m, tx.Commit(ctx)
}

func (s *MessageStore) DeleteMessage(ctx context.Context, messageID, actorID string, expectedVersion int, now time.Time) (store.Message, error) {
	tx, err := s.pool.Begin(ctx); if err != nil { return store.Message{}, err }; defer tx.Rollback(ctx)
	var m store.Message; var raw []byte; var version int; var deleted *time.Time
	err = tx.QueryRow(ctx, `SELECT id, conversation_id, channel_id, sender_id, type, body, mentions, created_at, edit_version, deleted_at FROM messages WHERE id=$1 FOR UPDATE`, messageID).Scan(&m.ID, &m.ConversationID, &m.ChannelID, &m.SenderID, &m.Type, &m.Body, &raw, &m.CreatedAt, &version, &deleted)
	if errors.Is(err, pgx.ErrNoRows) { return store.Message{}, store.ErrNotFound }; if err != nil { return store.Message{}, err }
	if m.SenderID != actorID { return store.Message{}, errors.New("message delete forbidden") }; if deleted != nil { return m, nil }; if now.Sub(m.CreatedAt) > 15*time.Minute { return store.Message{}, errors.New("message delete window expired") }; if version != expectedVersion { return store.Message{}, errors.New("message version conflict") }
	if _, err = tx.Exec(ctx, `UPDATE messages SET deleted_at=$2, deleted_by=$3, edit_version=edit_version+1 WHERE id=$1`, messageID, now, actorID); err != nil { return store.Message{}, err }
	if _, err = tx.Exec(ctx, `INSERT INTO message_mutation_audit (id,message_id,actor_id,action,previous_hash) VALUES ($1,$2,$3,'delete',$4)`, uuid.New(), messageID, actorID, bodyHash(m.Body)); err != nil { return store.Message{}, err }
	_ = json.Unmarshal(raw, &m.Mentions); m.DeletedAt = &now; m.DeletedBy = actorID; m.EditVersion = version + 1; return m, tx.Commit(ctx)
}
