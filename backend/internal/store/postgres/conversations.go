package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

type ConversationStore struct{ pool *pgxpool.Pool }

// GetOrCreateDM finds the 1:1 conversation that has exactly userA and userB as
// participants, or creates it. Uses a transaction for create.
func (s *ConversationStore) GetOrCreateDM(ctx context.Context, a, b string) (store.Conversation, bool, error) {
	var convID string
	err := s.pool.QueryRow(ctx, `
		SELECT cp.conversation_id
		FROM conversation_participants cp
		JOIN conversation_participants cp2 ON cp.conversation_id = cp2.conversation_id
		WHERE cp.user_id=$1 AND cp2.user_id=$2
		GROUP BY cp.conversation_id
		HAVING count(*) = 1
		LIMIT 1`, a, b).Scan(&convID)
	if err == nil {
		return store.Conversation{ID: convID}, false, nil
	}
	if err != pgx.ErrNoRows {
		return store.Conversation{}, false, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return store.Conversation{}, false, err
	}
	defer tx.Rollback(ctx)
	newID := uuid.Must(uuid.NewV7()).String()
	if _, err := tx.Exec(ctx, `INSERT INTO conversations (id) VALUES ($1)`, newID); err != nil {
		return store.Conversation{}, false, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1,$2),($1,$3)`, newID, a, b); err != nil {
		return store.Conversation{}, false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return store.Conversation{}, false, err
	}
	return store.Conversation{ID: newID}, true, nil
}

func (s *ConversationStore) Participants(ctx context.Context, convID string) ([]string, error) {
	rows, err := s.pool.Query(ctx, `SELECT user_id FROM conversation_participants WHERE conversation_id=$1 ORDER BY user_id`, convID)
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
	if len(out) == 0 {
		return nil, store.ErrNotFound
	}
	return out, rows.Err()
}

func (s *ConversationStore) IsParticipant(ctx context.Context, convID, userID string) (bool, error) {
	var x int
	err := s.pool.QueryRow(ctx, `SELECT 1 FROM conversation_participants WHERE conversation_id=$1 AND user_id=$2`, convID, userID).Scan(&x)
	if err == pgx.ErrNoRows {
		return false, nil
	}
	return err == nil, err
}

func (s *ConversationStore) ListForUser(ctx context.Context, userID string) ([]string, error) {
	rows, err := s.pool.Query(ctx, `SELECT conversation_id FROM conversation_participants WHERE user_id=$1`, userID)
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

func (s *ConversationStore) SetReadCursor(ctx context.Context, convID, userID, msgID string) error {
	_, err := s.pool.Exec(ctx, `UPDATE conversation_participants SET last_read_msg_id=$3 WHERE conversation_id=$1 AND user_id=$2`, convID, userID, msgID)
	return err
}
