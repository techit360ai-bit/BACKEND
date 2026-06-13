// Package demo implements the WS2 demo-room lifecycle: events, roster, invites,
// status state-machine, and host/participant authorization over a store.DemoStore.
package demo

import (
	"context"
	"errors"
	"time"

	"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

var (
	ErrEventNotFound  = errors.New("demo: event not found")
	ErrNotHost        = errors.New("demo: not event host")
	ErrNotParticipant = errors.New("demo: not a participant")
	ErrNotInvitee     = errors.New("demo: not an invitee")
	ErrInvalidField   = errors.New("demo: invalid field value")
	ErrBadTransition  = errors.New("demo: invalid status transition")
	ErrNotEditable    = errors.New("demo: event not editable")
)

// CreateEventInput is the payload for creating a demo event.
type CreateEventInput struct {
	Kind        string
	Title       string
	Description string
	AssetURL    string
	AssetType   string
	ScheduledAt *time.Time
}

// PatchEventInput holds optional edits; nil fields are left unchanged.
type PatchEventInput struct {
	Title       *string
	Description *string
	AssetURL    *string
	AssetType   *string
	ScheduledAt *time.Time
}

// InviteInput invites a user to an event in a given room role.
type InviteInput struct {
	UserID   string
	RoomRole string
}

// Service owns demo-event lifecycle logic over a DemoStore.
type Service struct {
	store store.DemoStore
	now   func() time.Time
}

// New builds a Service backed by the given store.
func New(s store.DemoStore) *Service { return &Service{store: s, now: time.Now} }

func (s *Service) getEvent(ctx context.Context, id string) (store.DemoEvent, error) {
	ev, err := s.store.GetEvent(ctx, id)
	if errors.Is(err, store.ErrNotFound) {
		return store.DemoEvent{}, ErrEventNotFound
	}
	return ev, err
}

// Create stamps a draft event and adds the host to the roster (accepted).
func (s *Service) Create(ctx context.Context, hostID string, in CreateEventInput) (store.DemoEvent, error) {
	if !store.KnownDemoKind[in.Kind] || in.Title == "" {
		return store.DemoEvent{}, ErrInvalidField
	}
	if in.AssetType != "" && !store.KnownAssetType[in.AssetType] {
		return store.DemoEvent{}, ErrInvalidField
	}
	now := s.now().UTC()
	ev := store.DemoEvent{
		ID: protocol.NewMsgID(), HostID: hostID, Kind: in.Kind, Title: in.Title,
		Description: in.Description, AssetURL: in.AssetURL, AssetType: in.AssetType,
		Status: "draft", ScheduledAt: in.ScheduledAt, CreatedAt: now, UpdatedAt: now,
	}
	if err := s.store.CreateEvent(ctx, ev); err != nil {
		return store.DemoEvent{}, err
	}
	host := store.RosterEntry{
		EventID: ev.ID, UserID: hostID, RoomRole: "host", Status: "accepted",
		CreatedAt: now, UpdatedAt: now,
	}
	if err := s.store.UpsertRoster(ctx, host); err != nil {
		return store.DemoEvent{}, err
	}
	return ev, nil
}

// GetEvent returns the event if userID is the host or on the roster.
func (s *Service) GetEvent(ctx context.Context, eventID, userID string) (store.DemoEvent, error) {
	ev, err := s.getEvent(ctx, eventID)
	if err != nil {
		return store.DemoEvent{}, err
	}
	if ev.HostID == userID {
		return ev, nil
	}
	if _, err := s.store.GetRosterEntry(ctx, eventID, userID); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return store.DemoEvent{}, ErrNotParticipant
		}
		return store.DemoEvent{}, err
	}
	return ev, nil
}

// ListEventsForUser returns events the user hosts or is rostered on.
func (s *Service) ListEventsForUser(ctx context.Context, userID string) ([]store.DemoEvent, error) {
	return s.store.ListEventsForUser(ctx, userID)
}

// ListRoster returns the roster for an event the user can see.
func (s *Service) ListRoster(ctx context.Context, eventID, userID string) ([]store.RosterEntry, error) {
	if _, err := s.GetEvent(ctx, eventID, userID); err != nil {
		return nil, err
	}
	return s.store.ListRoster(ctx, eventID)
}

// Transition moves an event to a new status (host only, validated state machine).
func (s *Service) Transition(ctx context.Context, eventID, userID, to string) (store.DemoEvent, error) {
	ev, err := s.getEvent(ctx, eventID)
	if err != nil {
		return store.DemoEvent{}, err
	}
	if ev.HostID != userID {
		return store.DemoEvent{}, ErrNotHost
	}
	if !store.KnownDemoStatus[to] {
		return store.DemoEvent{}, ErrInvalidField
	}
	if !store.AllowedDemoTransition(ev.Status, to) {
		return store.DemoEvent{}, ErrBadTransition
	}
	ev.Status = to
	ev.UpdatedAt = s.now().UTC()
	if err := s.store.UpdateEvent(ctx, ev); err != nil {
		return store.DemoEvent{}, err
	}
	return ev, nil
}

// UpdateEvent edits a draft event (host only).
func (s *Service) UpdateEvent(ctx context.Context, eventID, userID string, in PatchEventInput) (store.DemoEvent, error) {
	ev, err := s.getEvent(ctx, eventID)
	if err != nil {
		return store.DemoEvent{}, err
	}
	if ev.HostID != userID {
		return store.DemoEvent{}, ErrNotHost
	}
	if ev.Status != "draft" {
		return store.DemoEvent{}, ErrNotEditable
	}
	if in.AssetType != nil && *in.AssetType != "" && !store.KnownAssetType[*in.AssetType] {
		return store.DemoEvent{}, ErrInvalidField
	}
	if in.Title != nil {
		if *in.Title == "" {
			return store.DemoEvent{}, ErrInvalidField
		}
		ev.Title = *in.Title
	}
	if in.Description != nil {
		ev.Description = *in.Description
	}
	if in.AssetURL != nil {
		ev.AssetURL = *in.AssetURL
	}
	if in.AssetType != nil {
		ev.AssetType = *in.AssetType
	}
	if in.ScheduledAt != nil {
		ev.ScheduledAt = in.ScheduledAt
	}
	ev.UpdatedAt = s.now().UTC()
	if err := s.store.UpdateEvent(ctx, ev); err != nil {
		return store.DemoEvent{}, err
	}
	return ev, nil
}

// Invite adds a user to the roster as "invited" (host only).
func (s *Service) Invite(ctx context.Context, eventID, hostID string, in InviteInput) (store.RosterEntry, error) {
	ev, err := s.getEvent(ctx, eventID)
	if err != nil {
		return store.RosterEntry{}, err
	}
	if ev.HostID != hostID {
		return store.RosterEntry{}, ErrNotHost
	}
	if in.UserID == "" || !store.KnownRoomRole[in.RoomRole] {
		return store.RosterEntry{}, ErrInvalidField
	}
	now := s.now().UTC()
	r := store.RosterEntry{
		EventID: eventID, UserID: in.UserID, RoomRole: in.RoomRole, Status: "invited",
		CreatedAt: now, UpdatedAt: now,
	}
	if err := s.store.UpsertRoster(ctx, r); err != nil {
		return store.RosterEntry{}, err
	}
	return r, nil
}

// RespondInvite lets an invitee accept or decline.
func (s *Service) RespondInvite(ctx context.Context, eventID, userID string, accept bool) (store.RosterEntry, error) {
	r, err := s.store.GetRosterEntry(ctx, eventID, userID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return store.RosterEntry{}, ErrNotInvitee
		}
		return store.RosterEntry{}, err
	}
	if accept {
		r.Status = "accepted"
	} else {
		r.Status = "declined"
	}
	r.UpdatedAt = s.now().UTC()
	if err := s.store.UpsertRoster(ctx, r); err != nil {
		return store.RosterEntry{}, err
	}
	return r, nil
}
