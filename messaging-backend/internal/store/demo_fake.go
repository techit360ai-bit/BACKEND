package store

import (
	"context"
	"sort"
	"sync"
)

// FakeDemoStore is an in-memory DemoStore for unit tests.
type FakeDemoStore struct {
	mu     sync.Mutex
	events map[string]DemoEvent
	roster map[string][]RosterEntry // eventID -> entries
}

func (s *FakeDemoStore) CreateEvent(_ context.Context, e DemoEvent) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.events[e.ID] = e
	return nil
}

func (s *FakeDemoStore) GetEvent(_ context.Context, id string) (DemoEvent, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	e, ok := s.events[id]
	if !ok {
		return DemoEvent{}, ErrNotFound
	}
	return e, nil
}

func (s *FakeDemoStore) ListEventsForUser(_ context.Context, userID string) ([]DemoEvent, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	seen := map[string]bool{}
	var out []DemoEvent
	for id, e := range s.events {
		if e.HostID == userID {
			out = append(out, e)
			seen[id] = true
		}
	}
	for eid, entries := range s.roster {
		if seen[eid] {
			continue
		}
		for _, r := range entries {
			if r.UserID == userID {
				if e, ok := s.events[eid]; ok {
					out = append(out, e)
				}
				break
			}
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out, nil
}

func (s *FakeDemoStore) UpdateEvent(_ context.Context, e DemoEvent) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.events[e.ID]; !ok {
		return ErrNotFound
	}
	s.events[e.ID] = e
	return nil
}

func (s *FakeDemoStore) UpsertRoster(_ context.Context, r RosterEntry) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	list := s.roster[r.EventID]
	for i, ex := range list {
		if ex.UserID == r.UserID {
			list[i] = r
			s.roster[r.EventID] = list
			return nil
		}
	}
	s.roster[r.EventID] = append(list, r)
	return nil
}

func (s *FakeDemoStore) GetRosterEntry(_ context.Context, eventID, userID string) (RosterEntry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, r := range s.roster[eventID] {
		if r.UserID == userID {
			return r, nil
		}
	}
	return RosterEntry{}, ErrNotFound
}

func (s *FakeDemoStore) ListRoster(_ context.Context, eventID string) ([]RosterEntry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]RosterEntry(nil), s.roster[eventID]...), nil
}
