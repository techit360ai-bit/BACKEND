package store

import (
	"context"
	"time"
)

// DemoQuestion is one audience question in a demo event's Q&A.
// Votes is a derived read field (count), not a stored column.
type DemoQuestion struct {
	ID        string
	EventID   string
	AskerID   string
	Body      string
	State     string // open | answered | dismissed
	Votes     int
	CreatedAt time.Time
	UpdatedAt time.Time
}

// QuestionView is a question plus whether the viewer has upvoted it.
type QuestionView struct {
	DemoQuestion
	Mine bool
}

// KnownQuestionState gates resolve states (open is the default, set at creation).
var KnownQuestionState = map[string]bool{"open": true, "answered": true, "dismissed": true}

// QAStore persists demo questions and their votes.
type QAStore interface {
	CreateQuestion(ctx context.Context, q DemoQuestion) error
	GetQuestion(ctx context.Context, id string) (DemoQuestion, error)
	ListQuestions(ctx context.Context, eventID, viewerID string) ([]QuestionView, error)
	SetQuestionState(ctx context.Context, id, state string) error
	AddVote(ctx context.Context, questionID, userID string) (bool, error)    // true if inserted
	RemoveVote(ctx context.Context, questionID, userID string) (bool, error) // true if deleted
	CountVotes(ctx context.Context, questionID string) (int, error)
}
