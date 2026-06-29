// Package qa implements WS2 audience Q&A: ask / upvote (toggle) / resolve over a
// store.QAStore, authorized via demo.Service, with qa.* fan-out to the event
// roster through a store.Router. Mirrors the channel/feed slices.
package qa

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/demo"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/protocol"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/store"
)

var (
	ErrNotLive          = errors.New("qa: event is not live")
	ErrQuestionNotFound = errors.New("qa: question not found")
	ErrInvalidState     = errors.New("qa: invalid resolve state")
	ErrEmptyBody        = errors.New("qa: empty question body")
)

// Service owns Q&A rules + fan-out.
type Service struct {
	qa     store.QAStore
	demos  *demo.Service
	router store.Router
	now    func() time.Time
}

// New builds a qa.Service. router may be nil (fan-out becomes a no-op) for tests.
func New(qs store.QAStore, demos *demo.Service, r store.Router) *Service {
	return &Service{qa: qs, demos: demos, router: r, now: time.Now}
}

// requireLive authorizes userID for the event (host or rostered) and requires live.
func (s *Service) requireLive(ctx context.Context, eventID, userID string) (store.DemoEvent, error) {
	ev, err := s.demos.GetEvent(ctx, eventID, userID) // 403/404 via demo errors
	if err != nil {
		return store.DemoEvent{}, err
	}
	if ev.Status != "live" {
		return store.DemoEvent{}, ErrNotLive
	}
	return ev, nil
}

// Ask persists a new question (live + participant) and broadcasts qa.new.
func (s *Service) Ask(ctx context.Context, eventID, askerID, body string) (store.DemoQuestion, error) {
	if _, err := s.requireLive(ctx, eventID, askerID); err != nil {
		return store.DemoQuestion{}, err
	}
	body = strings.TrimSpace(body)
	if body == "" {
		return store.DemoQuestion{}, ErrEmptyBody
	}
	now := s.now().UTC()
	q := store.DemoQuestion{
		ID: protocol.NewMsgID(), EventID: eventID, AskerID: askerID, Body: body,
		State: "open", Votes: 0, CreatedAt: now, UpdatedAt: now,
	}
	if err := s.qa.CreateQuestion(ctx, q); err != nil {
		return store.DemoQuestion{}, err
	}
	s.broadcast(ctx, eventID, protocol.TypeQANew, map[string]any{
		"eventId": eventID,
		"question": map[string]any{
			"id": q.ID, "eventId": q.EventID, "askerId": q.AskerID, "body": q.Body,
			"state": q.State, "votes": 0, "createdAt": q.CreatedAt.Format(time.RFC3339),
		},
	})
	return q, nil
}

// Upvote toggles the caller's vote and broadcasts qa.voted with the new count.
func (s *Service) Upvote(ctx context.Context, eventID, questionID, userID string) (int, bool, error) {
	if _, err := s.requireLive(ctx, eventID, userID); err != nil {
		return 0, false, err
	}
	q, err := s.qa.GetQuestion(ctx, questionID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return 0, false, ErrQuestionNotFound
		}
		return 0, false, err
	}
	if q.EventID != eventID {
		return 0, false, ErrQuestionNotFound
	}
	inserted, err := s.qa.AddVote(ctx, questionID, userID)
	if err != nil {
		return 0, false, err
	}
	mine := true
	if !inserted {
		if _, err := s.qa.RemoveVote(ctx, questionID, userID); err != nil {
			return 0, false, err
		}
		mine = false
	}
	votes, err := s.qa.CountVotes(ctx, questionID)
	if err != nil {
		return 0, false, err
	}
	s.broadcast(ctx, eventID, protocol.TypeQAVoted, map[string]any{
		"eventId": eventID, "questionId": questionID, "votes": votes,
	})
	return votes, mine, nil
}

// Resolve marks a question answered/dismissed (host or presenter, live).
func (s *Service) Resolve(ctx context.Context, eventID, questionID, userID, state string) (store.DemoQuestion, error) {
	ev, err := s.requireLive(ctx, eventID, userID)
	if err != nil {
		return store.DemoQuestion{}, err
	}
	if !s.isHostOrPresenter(ctx, ev, userID) {
		return store.DemoQuestion{}, demo.ErrNotHost
	}
	if state != "answered" && state != "dismissed" {
		return store.DemoQuestion{}, ErrInvalidState
	}
	q, err := s.qa.GetQuestion(ctx, questionID)
	if err != nil || q.EventID != eventID {
		return store.DemoQuestion{}, ErrQuestionNotFound
	}
	if err := s.qa.SetQuestionState(ctx, questionID, state); err != nil {
		return store.DemoQuestion{}, err
	}
	q.State = state
	s.broadcast(ctx, eventID, protocol.TypeQAResolved, map[string]any{
		"eventId": eventID, "questionId": questionID, "state": state,
	})
	return q, nil
}

// List returns the event's questions in arrival order (participant-only).
func (s *Service) List(ctx context.Context, eventID, userID string) ([]store.QuestionView, error) {
	if _, err := s.demos.GetEvent(ctx, eventID, userID); err != nil {
		return nil, err
	}
	return s.qa.ListQuestions(ctx, eventID, userID)
}

func (s *Service) isHostOrPresenter(ctx context.Context, ev store.DemoEvent, userID string) bool {
	if ev.HostID == userID {
		return true
	}
	roster, err := s.demos.Roster(ctx, ev.ID)
	if err != nil {
		return false
	}
	for _, e := range roster {
		if e.UserID == userID && e.RoomRole == "presenter" {
			return true
		}
	}
	return false
}

// broadcast fans an envelope out to every roster member (nil-router safe).
func (s *Service) broadcast(ctx context.Context, eventID, typ string, data map[string]any) {
	if s.router == nil {
		return
	}
	roster, err := s.demos.Roster(ctx, eventID)
	if err != nil {
		return
	}
	raw, _ := json.Marshal(data)
	env := protocol.Envelope{Type: typ, ID: protocol.NewMsgID(), TS: s.now().UTC().Format(time.RFC3339), Data: raw}
	for _, e := range roster {
		_, _ = s.router.RouteToUser(ctx, e.UserID, env)
	}
}
