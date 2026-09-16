package main

import (
	"testing"

	"github.com/example/app/internal/notify"
)

// TestSenderSend exercises the notify package from a _test.go file that lives
// OUTSIDE that package. It is therefore a genuine reverse dependency of
// internal/notify, which is exactly what makes it a fixture: a test file must
// never be reported as part of a blast radius, but it must still be reported as
// a test that covers the change.
func TestSenderSend(t *testing.T) {
	sender := notify.NewSender("test")
	if err := sender.Send("hello"); err != nil {
		t.Fatalf("send error: %v", err)
	}
}
