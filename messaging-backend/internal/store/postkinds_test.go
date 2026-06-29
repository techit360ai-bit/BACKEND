package store

import "testing"

func TestAllowedKind(t *testing.T) {
	// generic accepted for every role
	for _, role := range []string{"founder", "collaborator", "investor", "organisation", "community"} {
		if !AllowedKind(role, "milestone") {
			t.Fatalf("generic milestone should be allowed for %s", role)
		}
	}
	if !AllowedKind("founder", "update") {
		t.Fatal("legacy update must stay valid")
	}
	if !AllowedKind("founder", "build") || !AllowedKind("founder", "collab") {
		t.Fatal("legacy aliases build/collab must stay valid")
	}
	// role-specific accepted only for its role
	if !AllowedKind("collaborator", "role-available") {
		t.Fatal("collaborator may post role-available")
	}
	if !AllowedKind("investor", "investment-signal") {
		t.Fatal("investor may post investment-signal")
	}
	if !AllowedKind("organisation", "opportunity-post") {
		t.Fatal("organisation may post opportunity-post")
	}
	// cross-role rejected
	if AllowedKind("collaborator", "investment-signal") {
		t.Fatal("collaborator must NOT post investment-signal")
	}
	if AllowedKind("founder", "skill-showcase") {
		t.Fatal("founder must NOT post collaborator kind")
	}
	// unknown role -> generic only
	if AllowedKind("wizard", "role-available") {
		t.Fatal("unknown role gets generic only")
	}
	if !AllowedKind("wizard", "insight") {
		t.Fatal("unknown role still gets generic")
	}
}
