// Package auth verifies RS256 JWTs carrying the messaging identity
// claims {sub, name, role}. Real issuance lives elsewhere (WS5); Mint is for dev
// and tests. The claim contract must eventually match the platform issuer.
package auth

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Claims is the messaging identity extracted from a token.
type Claims struct {
	UserID           string
	Name             string
	Role             string
	Username         string
	AvatarURL        string
	Verified         bool
	Subscriber       bool
	SubscriptionTier string
	CredibilityScore int
	IdentityPresent  bool
}

// Verifier verifies RS256 tokens with a public key and retains HS256 only for
// development/test compatibility.
type Verifier struct {
	secret   []byte
	publicKey *rsa.PublicKey
	issuer   string
	audience string
}

func NewVerifier(secret string, values ...string) *Verifier {
	v := &Verifier{secret: []byte(secret)}
	v.WithPublicKey(os.Getenv("JWT_PUBLIC_KEY"))
	if len(values) > 0 {
		v.issuer = values[0]
	}
	if len(values) > 1 {
		v.audience = values[1]
	}
	return v
}

// WithPublicKey sets the RS256 verification key from a PEM-encoded public key.
// It is safe to call with an empty string (HS256/development path).
func (v *Verifier) WithPublicKey(raw string) *Verifier {
	if raw == "" {
		return v
	}
	if block, _ := pem.Decode([]byte(raw)); block != nil {
		if key, err := x509.ParsePKIXPublicKey(block.Bytes); err == nil {
			if rsaKey, ok := key.(*rsa.PublicKey); ok {
				v.publicKey = rsaKey
			}
		}
	}
	return v
}

// Verify parses and validates a platform token, returning its identity claims.
func (v *Verifier) Verify(token string) (Claims, error) {
	parsed, err := jwt.Parse(token, func(t *jwt.Token) (any, error) {
		if v.publicKey != nil {
			if t.Method != jwt.SigningMethodRS256 { return nil, errors.New("unexpected signing method") }
			return v.publicKey, nil
		}
		if os.Getenv("ENVIRONMENT") == "production" || os.Getenv("ENVIRONMENT") == "staging" { return nil, errors.New("asymmetric verification key is required") }
		if t.Method != jwt.SigningMethodHS256 { return nil, errors.New("unexpected signing method") }
		return v.secret, nil
	})
	if err != nil {
		return Claims{}, err
	}
	mc, ok := parsed.Claims.(jwt.MapClaims)
	if !ok || !parsed.Valid {
		return Claims{}, errors.New("invalid token")
	}
	if v.issuer != "" {
		if value, _ := mc["iss"].(string); value != v.issuer {
			return Claims{}, errors.New("invalid issuer")
		}
	}
	if v.audience != "" {
		validAudience := false
		switch value := mc["aud"].(type) {
		case string:
			validAudience = value == v.audience
		case []any:
			for _, item := range value {
				if item == v.audience {
					validAudience = true
					break
				}
			}
		}
		if !validAudience {
			return Claims{}, errors.New("invalid audience")
		}
	}
	sub, _ := mc["sub"].(string)
	if sub == "" {
		return Claims{}, errors.New("missing sub claim")
	}
	name, _ := mc["name"].(string)
	role, _ := mc["role"].(string)
	username, _ := mc["username"].(string)
	avatarURL, _ := mc["avatar_url"].(string)
	verified, _ := mc["verified"].(bool)
	subscriber, _ := mc["subscriber"].(bool)
	subscriptionTier, _ := mc["subscription_tier"].(string)
	credibilityScore := 0
	if raw, ok := mc["credibility_score"].(float64); ok {
		credibilityScore = int(raw)
	}
	_, hasVerified := mc["verified"]
	_, hasSubscriber := mc["subscriber"]
	_, hasCredibility := mc["credibility_score"]
	return Claims{UserID: sub, Name: name, Role: role, Username: username, AvatarURL: avatarURL, Verified: verified, Subscriber: subscriber, SubscriptionTier: subscriptionTier, CredibilityScore: credibilityScore, IdentityPresent: hasVerified || hasSubscriber || hasCredibility || username != ""}, nil
}

// Mint creates a token valid for 24h (dev/testing only).
func (v *Verifier) Mint(userID, name, role string) (string, error) {
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  userID,
		"name": name,
		"role": role,
		"iat":  time.Now().Unix(),
		"exp":  time.Now().Add(24 * time.Hour).Unix(),
	})
	return tok.SignedString(v.secret)
}
