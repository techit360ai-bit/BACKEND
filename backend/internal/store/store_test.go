package store

import "testing"

// Compile-time + basic sanity that the domain types and sentinel exist.
func TestErrNotFoundMessage(t *testing.T) {
	if ErrNotFound == nil || ErrNotFound.Error() == "" {
		t.Fatal("ErrNotFound must be a non-empty error")
	}
}

func TestMessageZeroValue(t *testing.T) {
	var m Message
	if m.ID != "" || m.Body != "" {
		t.Fatal("unexpected non-zero default")
	}
}

func TestChannelAndPostZeroValues(t *testing.T) {
	var c Channel
	var p Post
	var cm Comment
	if c.ID != "" || p.ID != "" || cm.ID != "" {
		t.Fatal("unexpected non-zero defaults")
	}
}

func TestPostHasRoleFields(t *testing.T) {
	p := Post{ID: "p1", AuthorID: "u1", AuthorRole: "founder", Audience: []string{"collaborator"}, Kind: "update", Body: "x"}
	if p.AuthorRole != "founder" || len(p.Audience) != 1 || p.Audience[0] != "collaborator" {
		t.Fatalf("role fields not set: %+v", p)
	}
}
