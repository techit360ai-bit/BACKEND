package postgres

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/store"
)

type ChannelStore struct{ pool *pgxpool.Pool }

func channelBodyHash(value string) string { return fmt.Sprintf("%x", sha256.Sum256([]byte(value))) }

func (s *ChannelStore) ListForUser(ctx context.Context, userID string) ([]store.Channel, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT c.id, c.name, c.kind, c.created_at
		FROM channels c JOIN channel_members m ON m.channel_id = c.id
		WHERE m.user_id = $1 ORDER BY c.created_at`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []store.Channel
	for rows.Next() {
		var c store.Channel
		if err := rows.Scan(&c.ID, &c.Name, &c.Kind, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *ChannelStore) Members(ctx context.Context, channelID string) ([]string, error) {
	rows, err := s.pool.Query(ctx, `SELECT user_id FROM channel_members WHERE channel_id=$1 ORDER BY user_id`, channelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

func (s *ChannelStore) IsMember(ctx context.Context, channelID, userID string) (bool, error) {
	var x int
	err := s.pool.QueryRow(ctx, `SELECT 1 FROM channel_members WHERE channel_id=$1 AND user_id=$2`, channelID, userID).Scan(&x)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}

func (s *ChannelStore) MessagesByChannel(ctx context.Context, channelID, before string, limit int) ([]store.Message, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	q := `SELECT id, channel_id, sender_id, type, body, created_at, edited_at, edit_version, deleted_at, deleted_by FROM messages WHERE channel_id=$1`
	args := []any{channelID}
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
		var deletedBy *string
		if err := rows.Scan(&m.ID, &m.ChannelID, &m.SenderID, &m.Type, &m.Body, &m.CreatedAt, &m.EditedAt, &m.EditVersion, &m.DeletedAt, &deletedBy); err != nil {
			return nil, err
		}
		if deletedBy != nil { m.DeletedBy = *deletedBy }
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *ChannelStore) InsertChannelMessage(ctx context.Context, m store.Message, clientMsgID string) error {
	var cmid any
	if clientMsgID != "" {
		cmid = clientMsgID
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO messages (id, channel_id, sender_id, client_msg_id, type, body, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		m.ID, m.ChannelID, m.SenderID, cmid, m.Type, m.Body, m.CreatedAt)
	return err
}

func (s *ChannelStore) ExistsByClientMsgID(ctx context.Context, channelID, senderID, clientMsgID string) (string, bool, error) {
	if clientMsgID == "" {
		return "", false, nil
	}
	var id string
	err := s.pool.QueryRow(ctx, `SELECT id FROM messages WHERE channel_id=$1 AND sender_id=$2 AND client_msg_id=$3`, channelID, senderID, clientMsgID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return id, true, nil
}

func (s *ChannelStore) SetReadCursor(ctx context.Context, channelID, userID, msgID string) error {
	tag, err := s.pool.Exec(ctx, `UPDATE channel_members SET last_read_msg_id=$3 WHERE channel_id=$1 AND user_id=$2`, channelID, userID, msgID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return store.ErrNotFound
	}
	return nil
}

func (s *ChannelStore) EditMessage(ctx context.Context, messageID, actorID, body string, expectedVersion int, now time.Time) (store.Message, error) {
	tx, err := s.pool.Begin(ctx); if err != nil { return store.Message{}, err }; defer tx.Rollback(ctx)
	var m store.Message; var deleted *time.Time; var version int; var deletedBy *string
	err = tx.QueryRow(ctx, `SELECT id, channel_id, sender_id, type, body, created_at, edit_version, deleted_at, deleted_by FROM messages WHERE id=$1 AND channel_id IS NOT NULL FOR UPDATE`, messageID).Scan(&m.ID, &m.ChannelID, &m.SenderID, &m.Type, &m.Body, &m.CreatedAt, &version, &deleted, &deletedBy)
	if errors.Is(err, pgx.ErrNoRows) { return store.Message{}, store.ErrNotFound }; if err != nil { return store.Message{}, err }; if deletedBy != nil { m.DeletedBy = *deletedBy }
	if m.SenderID != actorID { return store.Message{}, errors.New("message edit forbidden") }; if deleted != nil { return store.Message{}, errors.New("message deleted") }; if now.Sub(m.CreatedAt) > 15*time.Minute { return store.Message{}, errors.New("message edit window expired") }; if version != expectedVersion { return store.Message{}, errors.New("message version conflict") }
	if _, err = tx.Exec(ctx, `UPDATE messages SET body=$2, edited_at=$3, edit_version=edit_version+1 WHERE id=$1`, messageID, body, now); err != nil { return store.Message{}, err }
	if _, err = tx.Exec(ctx, `INSERT INTO message_mutation_audit (id,message_id,actor_id,action,previous_hash,new_hash) VALUES ($1,$2,$3,'edit',$4,$5)`, uuid.New(), messageID, actorID, channelBodyHash(m.Body), channelBodyHash(body)); err != nil { return store.Message{}, err }
	m.Body = body; m.EditedAt = &now; m.EditVersion = version + 1; return m, tx.Commit(ctx)
}

func (s *ChannelStore) DeleteMessage(ctx context.Context, messageID, actorID string, expectedVersion int, now time.Time) (store.Message, error) {
	tx, err := s.pool.Begin(ctx); if err != nil { return store.Message{}, err }; defer tx.Rollback(ctx)
	var m store.Message; var deleted *time.Time; var version int; var deletedBy *string
	err = tx.QueryRow(ctx, `SELECT id, channel_id, sender_id, type, body, created_at, edit_version, deleted_at, deleted_by FROM messages WHERE id=$1 AND channel_id IS NOT NULL FOR UPDATE`, messageID).Scan(&m.ID, &m.ChannelID, &m.SenderID, &m.Type, &m.Body, &m.CreatedAt, &version, &deleted, &deletedBy)
	if errors.Is(err, pgx.ErrNoRows) { return store.Message{}, store.ErrNotFound }; if err != nil { return store.Message{}, err }; if deletedBy != nil { m.DeletedBy = *deletedBy }
	if m.SenderID != actorID { return store.Message{}, errors.New("message delete forbidden") }; if deleted != nil { return m, nil }; if now.Sub(m.CreatedAt) > 15*time.Minute { return store.Message{}, errors.New("message delete window expired") }; if version != expectedVersion { return store.Message{}, errors.New("message version conflict") }
	if _, err = tx.Exec(ctx, `UPDATE messages SET deleted_at=$2, deleted_by=$3, edit_version=edit_version+1 WHERE id=$1`, messageID, now, actorID); err != nil { return store.Message{}, err }
	if _, err = tx.Exec(ctx, `INSERT INTO message_mutation_audit (id,message_id,actor_id,action,previous_hash) VALUES ($1,$2,$3,'delete',$4)`, uuid.New(), messageID, actorID, channelBodyHash(m.Body)); err != nil { return store.Message{}, err }
	m.DeletedAt = &now; m.DeletedBy = actorID; m.EditVersion = version + 1; return m, tx.Commit(ctx)
}
