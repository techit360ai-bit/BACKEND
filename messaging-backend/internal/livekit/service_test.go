package livekit

import (
	"testing"

	"github.com/livekit/protocol/auth"
)

const (
	testKey    = "APIxxxxxxxx"
	testSecret = "secretsecretsecretsecretsecret12"
	testURL    = "wss://demo.livekit.cloud"
)

func TestTokenGrantsPerRole(t *testing.T) {
	s := New(testKey, testSecret, testURL)
	if !s.Enabled() {
		t.Fatal("service should be enabled with full config")
	}

	// host/presenter -> can publish
	tok, err := s.Token("room-1", "user-1", Grant{CanPublish: true})
	if err != nil {
		t.Fatalf("token: %v", err)
	}
	claims := verify(t, tok)
	if claims.Identity != "user-1" {
		t.Fatalf("identity = %q", claims.Identity)
	}
	if claims.Video.Room != "room-1" || !claims.Video.RoomJoin {
		t.Fatalf("bad room grant: %+v", claims.Video)
	}
	if claims.Video.CanPublish == nil || !*claims.Video.CanPublish {
		t.Fatal("expected CanPublish=true")
	}
	if claims.Video.CanSubscribe == nil || !*claims.Video.CanSubscribe {
		t.Fatal("expected CanSubscribe=true")
	}

	// audience -> subscribe only
	tok2, err := s.Token("room-1", "user-2", Grant{CanPublish: false})
	if err != nil {
		t.Fatalf("token2: %v", err)
	}
	c2 := verify(t, tok2)
	if c2.Video.CanPublish == nil || *c2.Video.CanPublish {
		t.Fatal("expected CanPublish=false for audience")
	}
}

func TestDisabledServiceErrors(t *testing.T) {
	s := New("", "", "")
	if s.Enabled() {
		t.Fatal("service should be disabled with empty config")
	}
	if _, err := s.Token("r", "u", Grant{}); err == nil {
		t.Fatal("expected error from disabled service")
	}
}

func verify(t *testing.T, token string) *auth.ClaimGrants {
	t.Helper()
	v, err := auth.ParseAPIToken(token)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	_, claims, err := v.Verify(testSecret)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	return claims
}
