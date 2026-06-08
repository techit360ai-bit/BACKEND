package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

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
	if _, err := tx.Exec(ctx, `
		INSERT INTO messages (id, conversation_id, sender_id, client_msg_id, type, body, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		m.ID, m.ConversationID, m.SenderID, cmid, m.Type, m.Body, m.CreatedAt); err != nil {
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
	q := `SELECT id, conversation_id, sender_id, type, body, created_at
	      FROM messages WHERE conversation_id=$1`
	args := []any{convID}
	if before != "" {
		q += ` AND id < $2`
		args = append(args, before)
	}
	q += ` ORDER BY id DESC LIMIT ` + itoa(limit)
	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []store.Message
	for rows.Next() {
		var m store.Message
		if err := rows.Scan(&m.ID, &m.ConversationID, &m.SenderID, &m.Type, &m.Body, &m.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *MessageStore) ExistsByClientMsgID(ctx context.Context, convID, senderID, clientMsgID string) (string, bool, error) {
	if clientMsgID == "" {
		return "", false, nil
	}
	var id string
	err := s.pool.QueryRow(ctx, `SELECT id FROM messages WHERE conversation_id=$1 AND sender_id=$2 AND client_msg_id=$3`, convID, senderID, clientMsgID).Scan(&id)
	if err == pgx.ErrNoRows {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return id, true, nil
}

// itoa avoids importing strconv for a small bounded int.
func itoa(n int) string {
	if n <= 0 {
		return "50"
	}
	digits := ""
	for n > 0 {
		digits = string(rune('0'+n%10)) + digits
		n /= 10
	}
	return digits
}
