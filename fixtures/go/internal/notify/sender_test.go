package notify

import "testing"

// TestNewSender exercises the notify package from a _test.go file that lives
// INSIDE the package — same `package notify` declaration, no import of the
// package itself. Go's compilation model gives this file direct access to
// every symbol in the package, so a change to sender.go can break it.
//
// This is the exact shape the GoModResolver misses: no import edge exists
// between this file and sender.go, yet this test is a genuine covering test
// for any change to the package.
func TestNewSender(t *testing.T) {
	s := NewSender("test-channel")
	if s == nil {
		t.Fatal("NewSender returned nil")
	}
}
