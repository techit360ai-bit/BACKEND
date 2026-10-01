package channel

import (
	"context"
	"testing"

	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/protocol"
	"github.com/techit360ai-bit/BACKEND/messaging-backend/internal/store/storetest"
)

func newSvc() (*Service, *storetest.FakeStores, *storetest.FakeRouter) {
	st := storetest.NewFakeStores()
	rt := storetest.NewFakeRouter()
	return New(st.Channels, rt), st, rt
}

func TestSendChannelFansOutToOtherMembers(t *testing.T) {
	svc, st, rt := newSvc()
	ctx := context.Background()
	st.Channels.AddMember("ch1", "u1")
	st.Channels.AddMember("ch1", "u2")
	st.Channels.AddMember("ch1", "u3")

	ack, err := svc.SendChannel(ctx, "u1", protocol.SendPayload{
		ChannelID: "ch1", ClientMsgID: "c1", Type: "text", Body: "team update",
	})
	if err != nil {
		t.Fatalf("send: %v", err)
	}
	if ack.MsgID == "" {
		t.Fatal("empty ack msgId")
	}
	// persisted
	msgs, _ := st.Channels.MessagesByChannel(ctx, "ch1", "", 10)
	if len(msgs) != 1 || msgs[0].Body != "team update" {
		t.Fatalf("not persisted: %v", msgs)
	}
	// fan-out to u2 and u3 but NOT back to sender u1
	if len(rt.Sent["u2"]) == 0 || rt.Sent["u2"][0].Type != protocol.TypeMessageNew {
		t.Errorf("u2 not delivered: %v", rt.Sent["u2"])
	}
	if len(rt.Sent["u3"]) == 0 {
		t.Errorf("u3 not delivered")
	}
	if len(rt.Sent["u1"]) != 0 {
		t.Errorf("sender u1 should not be fanned out to: %v", rt.Sent["u1"])
	}
}

func TestSendChannelRejectsNonMember(t *testing.T) {
	svc, st, _ := newSvc()
	st.Channels.AddMember("ch1", "u1")
	if _, err := svc.SendChannel(context.Background(), "stranger", protocol.SendPayload{ChannelID: "ch1", Body: "hi"}); err == nil {
		t.Fatal("expected rejection for non-member")
	}
}

func TestSendChannelDedup(t *testing.T) {
	svc, st, _ := newSvc()
	st.Channels.AddMember("ch1", "u1")
	p := protocol.SendPayload{ChannelID: "ch1", ClientMsgID: "dup", Body: "once"}
	r1, _ := svc.SendChannel(context.Background(), "u1", p)
	r2, _ := svc.SendChannel(context.Background(), "u1", p)
	if r1.MsgID != r2.MsgID {
		t.Errorf("dedup failed: %s vs %s", r1.MsgID, r2.MsgID)
	}
	msgs, _ := st.Channels.MessagesByChannel(context.Background(), "ch1", "", 10)
	if len(msgs) != 1 {
		t.Errorf("dedup should not double-insert, got %d", len(msgs))
	}
}

func TestRelayTypingToOtherMembers(t *testing.T) {
	svc, st, rt := newSvc()
	st.Channels.AddMember("ch1", "u1")
	st.Channels.AddMember("ch1", "u2")
	if err := svc.RelayTyping(context.Background(), "u1", "ch1", true); err != nil {
		t.Fatalf("typing: %v", err)
	}
	if len(rt.Sent["u2"]) == 0 || rt.Sent["u2"][0].Type != protocol.TypeTypingIndicator {
		t.Errorf("u2 missed typing indicator: %v", rt.Sent["u2"])
	}
	if len(rt.Sent["u1"]) != 0 {
		t.Errorf("typing should not echo to sender")
	}
}
