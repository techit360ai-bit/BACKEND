// Package livekit mints LiveKit access tokens for demo rooms. Token-only: it
// does not control rooms or media servers (that arrives with recording/Egress).
package livekit

import (
	"errors"
	"time"

	"github.com/livekit/protocol/auth"
)

// ErrDisabled is returned when LiveKit is not configured.
var ErrDisabled = errors.New("livekit: not configured")

// Grant is the minimal per-participant permission set we vary by room role.
type Grant struct {
	CanPublish bool
}

// Service mints LiveKit JWTs. Disabled (and returns ErrDisabled) until all of
// apiKey/apiSecret/url are set.
type Service struct {
	apiKey    string
	apiSecret string
	url       string
}

func New(apiKey, apiSecret, url string) *Service {
	return &Service{apiKey: apiKey, apiSecret: apiSecret, url: url}
}

func (s *Service) Enabled() bool {
	return s.apiKey != "" && s.apiSecret != "" && s.url != ""
}

// URL is the LiveKit ws URL clients connect to.
func (s *Service) URL() string { return s.url }

// Token mints a JWT for identity to join room with the given grant.
func (s *Service) Token(room, identity string, g Grant) (string, error) {
	if !s.Enabled() {
		return "", ErrDisabled
	}
	canPublish := g.CanPublish
	canSubscribe := true
	canData := true
	grant := &auth.VideoGrant{
		RoomJoin:       true,
		Room:           room,
		CanPublish:     &canPublish,
		CanSubscribe:   &canSubscribe,
		CanPublishData: &canData,
	}
	at := auth.NewAccessToken(s.apiKey, s.apiSecret).
		AddGrant(grant).
		SetIdentity(identity).
		SetValidFor(time.Hour)
	return at.ToJWT()
}
