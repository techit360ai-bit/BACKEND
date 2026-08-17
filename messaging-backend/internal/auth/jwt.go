// Package auth verifies and mints HS256 JWTs carrying the messaging identity
// claims {sub, name, role}. Real issuance lives elsewhere (WS5); Mint is for dev
// and tests. The claim contract must eventually match the platform issuer.
package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Claims is the messaging identity extracted from a token.
type Claims struct {
	UserID string
	Name   string
	Role   string
}

// Verifier verifies and mints HS256 tokens with a shared secret.
type Verifier struct {
	secret   []byte
	issuer   string
	audience string
}

func NewVerifier(secret string, values ...string) *Verifier {
	v := &Verifier{secret: []byte(secret)}
	if len(values) > 0 {
		v.issuer = values[0]
	}
	if len(values) > 1 {
		v.audience = values[1]
	}
	return v
}

// Verify parses and validates an HS256 token, returning its identity claims.
func (v *Verifier) Verify(token string) (Claims, error) {
	parsed, err := jwt.Parse(token, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("unexpected signing method")
		}
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
	return Claims{UserID: sub, Name: name, Role: role}, nil
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
