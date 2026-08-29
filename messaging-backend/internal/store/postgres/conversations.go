package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/store"
)

type ConversationStore struct{ pool *pgxpool.Pool }

// GetOrCreateDM returns the 1:1 conversation between the two users, creating it
// if absent. A unique dm_key (sorted "lo|hi" pair) lets the DB arbitrate
// concurrent creates: INSERT ... ON CONFLICT DO NOTHING means at most one row
// wins, and the losers fall through to a SELECT. Order-insensitive.
func (s *ConversationStore) GetOrCreateDM(ctx context.Context, a, b string) (store.Conversation, bool, error) {
	return s.GetOrCreateDMRequest(ctx, a, b, a, "active")
}

func (s *ConversationStore) GetOrCreateDMRequest(ctx context.Context, a, b, initiatedBy, requestStatus string) (store.Conversation, bool, error) {
	lo, hi := a, b
	if lo > hi {
		lo, hi = hi, lo
	}
	dmKey := lo + "|" + hi

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return store.Conversation{}, false, err
	}
	defer tx.Rollback(ctx)

	newID := uuid.Must(uuid.NewV7()).String()
	var gotID string
	err = tx.QueryRow(ctx,
		`INSERT INTO conversations (id, dm_key, initiated_by, request_status) VALUES ($1,$2,$3,$4)
		 ON CONFLICT (dm_key) WHERE dm_key IS NOT NULL DO NOTHING
		 RETURNING id`, newID, dmKey, initiatedBy, requestStatus).Scan(&gotID)
	if err == nil {
		// We created the conversation: insert both participants exactly once.
		if _, err := tx.Exec(ctx,
			`INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1,$2),($1,$3)`,
			gotID, a, b); err != nil {
			return store.Conversation{}, false, err
		}
		if err := tx.Commit(ctx); err != nil {
			return store.Conversation{}, false, err
		}
		return store.Conversation{ID: gotID, InitiatedBy: initiatedBy, RequestStatus: requestStatus}, true, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return store.Conversation{}, false, err
	}

	// Conflict: a conversation for this pair already exists. Participants are
	// already present from the winning create; just look up the id.
	var existing store.Conversation
	if err := tx.QueryRow(ctx, `SELECT id, COALESCE(initiated_by::text,''), request_status, created_at FROM conversations WHERE dm_key=$1`, dmKey).Scan(&existing.ID, &existing.InitiatedBy, &existing.RequestStatus, &existing.CreatedAt); err != nil {
		return store.Conversation{}, false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return store.Conversation{}, false, err
	}
	return existing, false, nil
}

func (s *ConversationStore) FindDM(ctx context.Context, a, b string) (store.Conversation, error) {
	lo, hi := a, b
	if lo > hi {
		lo, hi = hi, lo
	}
	var c store.Conversation
	err := s.pool.QueryRow(ctx, `SELECT id,COALESCE(initiated_by::text,''),request_status,created_at FROM conversations WHERE dm_key=$1`, lo+"|"+hi).Scan(&c.ID, &c.InitiatedBy, &c.RequestStatus, &c.CreatedAt)
	if err != nil {
		return store.Conversation{}, notFound(err)
	}
	return c, nil
}

func (s *ConversationStore) Get(ctx context.Context, convID string) (store.Conversation, error) {
	var c store.Conversation
	err := s.pool.QueryRow(ctx, `SELECT id,COALESCE(initiated_by::text,''),request_status,created_at FROM conversations WHERE id=$1`, convID).Scan(&c.ID, &c.InitiatedBy, &c.RequestStatus, &c.CreatedAt)
	if err != nil {
		return store.Conversation{}, notFound(err)
	}
	return c, nil
}

func (s *ConversationStore) SetRequestStatus(ctx context.Context, convID, status string) error {
	tag, err := s.pool.Exec(ctx, `UPDATE conversations SET request_status=$2, accepted_at=CASE WHEN $2='active' THEN now() ELSE accepted_at END, declined_at=CASE WHEN $2='declined' THEN now() ELSE declined_at END WHERE id=$1`, convID, status)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return store.ErrNotFound
	}
	return nil
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
	if errors.Is(err, pgx.ErrNoRows) {
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
	tag, err := s.pool.Exec(ctx, `UPDATE conversation_participants SET last_read_msg_id=$3 WHERE conversation_id=$1 AND user_id=$2`, convID, userID, msgID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return store.ErrNotFound
	}
	return nil
}

func (s *ConversationStore) SummariesForUser(ctx context.Context, userID string) ([]store.ConvSummary, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT cp.conversation_id,
		       other.user_id,
		       COALESCE(u.display_name, ''),
		       COALESCE(u.username, ''), COALESCE(u.avatar_url,''), COALESCE(u.role,''), u.verified, u.subscriber, u.credibility_score,
		       c.request_status, COALESCE(c.initiated_by::text,''),
		       COALESCE(lm.body, ''),
		       lm.created_at,
		       COALESCE(lm.id::text, ''),
		       (SELECT count(*) FROM messages m2
		          WHERE m2.conversation_id = cp.conversation_id
		            AND m2.sender_id <> $1
		            AND (cp.last_read_msg_id IS NULL OR m2.id > cp.last_read_msg_id)) AS unread
		FROM conversation_participants cp
		JOIN conversations c ON c.id=cp.conversation_id
		JOIN conversation_participants other
		  ON other.conversation_id = cp.conversation_id AND other.user_id <> cp.user_id
		LEFT JOIN users u ON u.id = other.user_id
		LEFT JOIN LATERAL (
		  SELECT id, body, created_at FROM messages m
		  WHERE m.conversation_id = cp.conversation_id
		  ORDER BY m.id DESC LIMIT 1
		) lm ON true
		WHERE cp.user_id = $1
		ORDER BY lm.created_at DESC NULLS LAST`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []store.ConvSummary
	for rows.Next() {
		var c store.ConvSummary
		var lastTS *time.Time
		if err := rows.Scan(&c.ConversationID, &c.OtherUserID, &c.OtherName, &c.OtherUsername, &c.OtherAvatarURL, &c.OtherRole, &c.OtherVerified, &c.OtherSubscriber, &c.OtherCredibilityScore, &c.RequestStatus, &c.InitiatedBy, &c.LastBody, &lastTS, &c.LastMsgID, &c.Unread); err != nil {
			return nil, err
		}
		if lastTS != nil {
			c.LastTS = *lastTS
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
