package storetest

import (
	"context"
	"sort"
	"sync"
)

// FakeQAStore is an in-memory QAStore for unit tests.
type FakeQAStore struct {
	mu        sync.Mutex
	questions map[string]DemoQuestion        // id -> question
	order     []string                       // insertion order (arrival)
	votes     map[string]map[string]struct{} // questionID -> set of userIDs
}

func (s *FakeQAStore) CreateQuestion(_ context.Context, q DemoQuestion) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.questions[q.ID] = q
	s.order = append(s.order, q.ID)
	return nil
}

func (s *FakeQAStore) GetQuestion(_ context.Context, id string) (DemoQuestion, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	q, ok := s.questions[id]
	if !ok {
		return DemoQuestion{}, ErrNotFound
	}
	return q, nil
}

func (s *FakeQAStore) ListQuestions(_ context.Context, eventID, viewerID string) ([]QuestionView, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []QuestionView
	for _, id := range s.order {
		q := s.questions[id]
		if q.EventID != eventID {
			continue
		}
		voters := s.votes[id]
		q.Votes = len(voters)
		_, mine := voters[viewerID]
		out = append(out, QuestionView{DemoQuestion: q, Mine: mine})
	}
	// order slice already arrival order; keep stable
	sort.SliceStable(out, func(i, j int) bool { return out[i].CreatedAt.Before(out[j].CreatedAt) })
	return out, nil
}

func (s *FakeQAStore) SetQuestionState(_ context.Context, id, state string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	q, ok := s.questions[id]
	if !ok {
		return ErrNotFound
	}
	q.State = state
	s.questions[id] = q
	return nil
}

func (s *FakeQAStore) AddVote(_ context.Context, questionID, userID string) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.questions[questionID]; !ok {
		return false, ErrNotFound
	}
	set := s.votes[questionID]
	if set == nil {
		set = map[string]struct{}{}
		s.votes[questionID] = set
	}
	if _, exists := set[userID]; exists {
		return false, nil
	}
	set[userID] = struct{}{}
	return true, nil
}

func (s *FakeQAStore) RemoveVote(_ context.Context, questionID, userID string) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	set := s.votes[questionID]
	if _, exists := set[userID]; !exists {
		return false, nil
	}
	delete(set, userID)
	return true, nil
}

func (s *FakeQAStore) CountVotes(_ context.Context, questionID string) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.votes[questionID]), nil
}
