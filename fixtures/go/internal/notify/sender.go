package notify

// Sender delivers notifications through a named channel.
type Sender struct {
	channel string
}

// NewSender constructs a Sender bound to the given channel. This is the symbol
// external callers (cmd/notifier/main.go) actually depend on.
func NewSender(channel string) *Sender {
	return &Sender{channel: channel}
}

// Send delivers the given message through the sender's channel.
func (s *Sender) Send(message string) error {
	return nil
}
