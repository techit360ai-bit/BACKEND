package store

import (
	"context"
	"time"
)

// DemoEvent is a Demo Day room (WS2). One model; kind distinguishes the type.
type DemoEvent struct {
	ID          string
	HostID      string
	Kind        string
	Title       string
	Description string
	AssetURL    string // "" when absent
	AssetType   string // "" when absent
	Status      string
	ScheduledAt *time.Time
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// RosterEntry is a participant in a demo event.
type RosterEntry struct {
	EventID   string
	UserID    string
	RoomRole  string
	Status    string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// Allow-sets (normalize-or-reject at the service layer).
var (
	KnownDemoKind   = map[string]bool{"startup": true, "investor": true, "hackathon": true, "launch": true, "mentorship": true}
	KnownAssetType  = map[string]bool{"deck": true, "slides": true, "video": true, "link": true}
	KnownRoomRole   = map[string]bool{"host": true, "presenter": true, "judge": true, "audience": true}
	KnownDemoStatus = map[string]bool{"draft": true, "scheduled": true, "live": true, "ended": true, "cancelled": true}
)

// demoTransitions lists the legal next statuses per status (host-only, forward).
var demoTransitions = map[string][]string{
	"draft":     {"scheduled", "cancelled"},
	"scheduled": {"live", "cancelled"},
	"live":      {"ended", "cancelled"},
}

// AllowedDemoTransition reports whether status `from` may move to `to`.
func AllowedDemoTransition(from, to string) bool {
	for _, n := range demoTransitions[from] {
		if n == to {
			return true
		}
	}
	return false
}

// DemoStore persists demo events and their rosters.
type DemoStore interface {
	CreateEvent(ctx context.Context, e DemoEvent) error
	GetEvent(ctx context.Context, id string) (DemoEvent, error)
	ListEventsForUser(ctx context.Context, userID string) ([]DemoEvent, error)
	UpdateEvent(ctx context.Context, e DemoEvent) error
	UpsertRoster(ctx context.Context, r RosterEntry) error
	GetRosterEntry(ctx context.Context, eventID, userID string) (RosterEntry, error)
	ListRoster(ctx context.Context, eventID string) ([]RosterEntry, error)
}
