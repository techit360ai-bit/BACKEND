package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

type QAStore struct{ pool *pgxpool.Pool }

var _ store.QAStore = (*QAStore)(nil)

func (s *QAStore) CreateQuestion(ctx context.Context, q store.DemoQuestion) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO demo_questions (id, event_id, asker_id, body, state, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		q.ID, q.EventID, q.AskerID, q.Body, q.State, q.CreatedAt, q.UpdatedAt)
	return err
}

func (s *QAStore) GetQuestion(ctx context.Context, id string) (store.DemoQuestion, error) {
	var q store.DemoQuestion
	err := s.pool.QueryRow(ctx, `
		SELECT id, event_id, asker_id, body, state, created_at, updated_at
		FROM demo_questions WHERE id=$1`, id).
		Scan(&q.ID, &q.EventID, &q.AskerID, &q.Body, &q.State, &q.CreatedAt, &q.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return store.DemoQuestion{}, store.ErrNotFound
	}
	return q, err
}

func (s *QAStore) ListQuestions(ctx context.Context, eventID, viewerID string) ([]store.QuestionView, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT q.id, q.event_id, q.asker_id, q.body, q.state, q.created_at, q.updated_at,
		       COUNT(v.user_id) AS votes,
		       BOOL_OR(v.user_id = $2) AS mine
		FROM demo_questions q
		LEFT JOIN demo_question_votes v ON v.question_id = q.id
		WHERE q.event_id = $1
		GROUP BY q.id
		ORDER BY q.created_at`, eventID, viewerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []store.QuestionView
	for rows.Next() {
		var qv store.QuestionView
		var mine *bool // BOOL_OR is NULL when there are no vote rows
		if err := rows.Scan(&qv.ID, &qv.EventID, &qv.AskerID, &qv.Body, &qv.State,
			&qv.CreatedAt, &qv.UpdatedAt, &qv.Votes, &mine); err != nil {
			return nil, err
		}
		qv.Mine = mine != nil && *mine
		out = append(out, qv)
	}
	return out, rows.Err()
}

func (s *QAStore) SetQuestionState(ctx context.Context, id, state string) error {
	tag, err := s.pool.Exec(ctx, `UPDATE demo_questions SET state=$2, updated_at=now() WHERE id=$1`, id, state)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return store.ErrNotFound
	}
	return nil
}

func (s *QAStore) AddVote(ctx context.Context, questionID, userID string) (bool, error) {
	tag, err := s.pool.Exec(ctx, `
		INSERT INTO demo_question_votes (question_id, user_id) VALUES ($1,$2)
		ON CONFLICT (question_id, user_id) DO NOTHING`, questionID, userID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

func (s *QAStore) RemoveVote(ctx context.Context, questionID, userID string) (bool, error) {
	tag, err := s.pool.Exec(ctx, `DELETE FROM demo_question_votes WHERE question_id=$1 AND user_id=$2`, questionID, userID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

func (s *QAStore) CountVotes(ctx context.Context, questionID string) (int, error) {
	var n int
	err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM demo_question_votes WHERE question_id=$1`, questionID).Scan(&n)
	return n, err
}
