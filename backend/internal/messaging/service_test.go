package messaging

import (
	"context"
	"testing"

	"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

func newSvc() (*Service, *store.FakeStores, *store.FakeRouter) {
	st := store.NewFakeStores()
	rt := store.NewFakeRouter()
	return New(st.Conversations, st.Messages, rt), st, rt
}

func TestSendDMPersistsThenAcksThenRoutes(t *testing.T) {
	svc, st, rt := newSvc()
	ctx := context.Background()
	c, _, _ := st.Conversations.GetOrCreateDM(ctx, "u1", "u2")
	rt.LocalUsers["u2"] = true // recipient online here

	res, err := svc.SendDM(ctx, "u1", protocol.SendPayload{
		ConvID: c.ID, ClientMsgID: "m1", Type: "text", Body: "hello",
	})
	if err != nil {
		t.Fatalf("SendDM: %v", err)
	}
	// persisted
	msgs, _ := st.Messages.MessagesByConversation(ctx, c.ID, "", 10)
	if len(msgs) != 1 || msgs[0].Body != "hello" {
		t.Fatalf("not persisted: %v", msgs)
	}
	// ack carries server msgId + clientMsgId
	if res.MsgID != msgs[0].ID || res.ClientMsgID != "m1" {
		t.Errorf("bad ack: %+v", res)
	}
	// recipient got message.new
	if got := rt.Sent["u2"]; len(got) == 0 || got[0].Type != protocol.TypeMessageNew {
		t.Errorf("recipient not routed message.new: %v", got)
	}
	// because recipient online locally, a delivered receipt routed back to sender
	senderEnv := rt.Sent["u1"]
	if len(senderEnv) == 0 || senderEnv[len(senderEnv)-1].Type != protocol.TypeReceiptUpdate {
		t.Errorf("sender did not get delivered receipt: %v", senderEnv)
	}
}

func TestSendDMRejectsNonParticipant(t *testing.T) {
	svc, st, _ := newSvc()
	ctx := context.Background()
	c, _, _ := st.Conversations.GetOrCreateDM(ctx, "u1", "u2")
	if _, err := svc.SendDM(ctx, "u3", protocol.SendPayload{ConvID: c.ID, ClientMsgID: "x", Body: "hi"}); err == nil {
		t.Fatal("expected rejection for non-participant")
	}
}

func TestSendDMDedupByClientMsgID(t *testing.T) {
	svc, st, _ := newSvc()
	ctx := context.Background()
	c, _, _ := st.Conversations.GetOrCreateDM(ctx, "u1", "u2")
	p := protocol.SendPayload{ConvID: c.ID, ClientMsgID: "dup", Body: "once"}
	r1, _ := svc.SendDM(ctx, "u1", p)
	r2, _ := svc.SendDM(ctx, "u1", p)
	if r1.MsgID != r2.MsgID {
		t.Errorf("dedup failed: %s vs %s", r1.MsgID, r2.MsgID)
	}
	msgs, _ := st.Messages.MessagesByConversation(ctx, c.ID, "", 10)
	if len(msgs) != 1 {
		t.Errorf("dedup should not double-insert, got %d", len(msgs))
	}
}

func TestSendDMOfflineRecipientNoDeliveredReceipt(t *testing.T) {
	svc, st, rt := newSvc()
	ctx := context.Background()
	c, _, _ := st.Conversations.GetOrCreateDM(ctx, "u1", "u2")
	// recipient u2 is NOT in rt.LocalUsers -> RouteToUser returns false (queued, not local)

	res, err := svc.SendDM(ctx, "u1", protocol.SendPayload{ConvID: c.ID, ClientMsgID: "m1", Body: "hi"})
	if err != nil {
		t.Fatalf("SendDM: %v", err)
	}
	// recipient still got message.new (RouteToUser was called, returned false)
	got := rt.Sent["u2"]
	if len(got) == 0 || got[0].Type != protocol.TypeMessageNew {
		t.Fatalf("recipient not routed message.new: %v", got)
	}
	// sender must NOT receive any delivered receipt
	for _, e := range rt.Sent["u1"] {
		if e.Type == protocol.TypeReceiptUpdate {
			t.Fatalf("sender unexpectedly got delivered receipt: %+v", e)
		}
	}
	_ = res
}

func TestMarkReadByNonParticipantRejected(t *testing.T) {
	svc, st, _ := newSvc()
	ctx := context.Background()
	c, _, _ := st.Conversations.GetOrCreateDM(ctx, "u1", "u2")
	res, _ := svc.SendDM(ctx, "u1", protocol.SendPayload{ConvID: c.ID, ClientMsgID: "m1", Body: "hi"})
	if err := svc.MarkRead(ctx, "u3", protocol.ReadUptoPayload{ConvID: c.ID, MsgID: res.MsgID}); err == nil {
		t.Fatal("expected rejection for non-participant reader")
	}
}

func TestMarkReadRejectsForeignMessage(t *testing.T) {
	svc, st, _ := newSvc()
	ctx := context.Background()
	convA, _, _ := st.Conversations.GetOrCreateDM(ctx, "u1", "u2")
	convB, _, _ := st.Conversations.GetOrCreateDM(ctx, "u1", "u3")
	// message lives in convB
	resB, _ := svc.SendDM(ctx, "u1", protocol.SendPayload{ConvID: convB.ID, ClientMsgID: "mb", Body: "hi"})
	// MarkRead in convA with a msgId from convB -> error
	if err := svc.MarkRead(ctx, "u2", protocol.ReadUptoPayload{ConvID: convA.ID, MsgID: resB.MsgID}); err == nil {
		t.Fatal("expected rejection for foreign message")
	}
}

func TestMarkReadSetsCursorAndReceipt(t *testing.T) {
	svc, st, rt := newSvc()
	ctx := context.Background()
	c, _, _ := st.Conversations.GetOrCreateDM(ctx, "u1", "u2")
	res, _ := svc.SendDM(ctx, "u1", protocol.SendPayload{ConvID: c.ID, ClientMsgID: "m1", Body: "hi"})
	rt.Sent["u1"] = nil // clear
	if err := svc.MarkRead(ctx, "u2", protocol.ReadUptoPayload{ConvID: c.ID, MsgID: res.MsgID}); err != nil {
		t.Fatalf("MarkRead: %v", err)
	}
	// sender gets a read receipt
	got := rt.Sent["u1"]
	if len(got) == 0 || got[len(got)-1].Type != protocol.TypeReceiptUpdate {
		t.Errorf("no read receipt to sender: %v", got)
	}
}
