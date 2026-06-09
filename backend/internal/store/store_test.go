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
