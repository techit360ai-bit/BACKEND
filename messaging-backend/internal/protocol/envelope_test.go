package protocol

import (
	"encoding/json"
	"testing"
)

func TestEnvelopeRoundTrip(t *testing.T) {
	in := Envelope{
		Type: TypeMessageSend,
		ID:   "01890000-0000-7000-8000-000000000000",
		TS:   "2026-06-08T00:00:00Z",
		Data: json.RawMessage(`{"convId":"c1","clientMsgId":"m1","type":"text","body":"hi"}`),
	}
	raw, err := json.Marshal(in)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var out Envelope
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if out.Type != TypeMessageSend || out.ID != in.ID {
		t.Errorf("round trip mismatch: %+v", out)
	}
}

func TestDecodeSendPayload(t *testing.T) {
	data := json.RawMessage(`{"convId":"c1","clientMsgId":"m1","type":"text","body":"hi"}`)
	var p SendPayload
	if err := json.Unmarshal(data, &p); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if p.ConvID != "c1" || p.ClientMsgID != "m1" || p.Body != "hi" {
		t.Errorf("bad payload: %+v", p)
	}
}

func TestNewMsgIDIsTimeOrdered(t *testing.T) {
	a := NewMsgID()
	b := NewMsgID()
	if a == "" || b == "" {
		t.Fatal("empty id")
	}
	if a >= b {
		t.Errorf("UUIDv7 not lexically time-ordered: a=%s b=%s", a, b)
	}
}

func TestPostPayloadDecode(t *testing.T) {
	data := json.RawMessage(`{"kind":"update","body":"shipped v1"}`)
	var p CreatePostPayload
	if err := json.Unmarshal(data, &p); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if p.Kind != "update" || p.Body != "shipped v1" {
		t.Errorf("bad payload: %+v", p)
	}
}

func TestPostServerTypesExist(t *testing.T) {
	if TypePostNew == "" || TypePostLiked == "" || TypePostComment == "" {
		t.Fatal("post server type constants must be non-empty")
	}
}

func TestQATypesDefined(t *testing.T) {
	if TypeQANew == "" || TypeQAVoted == "" || TypeQAResolved == "" {
		t.Fatal("qa.* type constants must be non-empty")
	}
	if TypeQANew != "qa.new" || TypeQAVoted != "qa.voted" || TypeQAResolved != "qa.resolved" {
		t.Fatalf("unexpected qa type values: %s %s %s", TypeQANew, TypeQAVoted, TypeQAResolved)
	}
}
