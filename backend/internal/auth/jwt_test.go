package auth

import "testing"

func TestMintThenVerify(t *testing.T) {
	v := NewVerifier("topsecret")
	tok, err := v.Mint("user-1", "Ada", "founder")
	if err != nil {
		t.Fatalf("mint: %v", err)
	}
	claims, err := v.Verify(tok)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if claims.UserID != "user-1" || claims.Name != "Ada" || claims.Role != "founder" {
		t.Errorf("bad claims: %+v", claims)
	}
}

func TestVerifyRejectsWrongSecret(t *testing.T) {
	good := NewVerifier("secretA")
	bad := NewVerifier("secretB")
	tok, _ := good.Mint("u", "n", "r")
	if _, err := bad.Verify(tok); err == nil {
		t.Fatal("expected verification failure with wrong secret")
	}
}

func TestVerifyRejectsGarbage(t *testing.T) {
	v := NewVerifier("s")
	if _, err := v.Verify("not.a.jwt"); err == nil {
		t.Fatal("expected error on malformed token")
	}
}
