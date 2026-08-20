package main

import (
	"log"

	"github.com/example/app/internal/notify"
)

func main() {
	sender := notify.NewSender("default")
	if err := sender.Send("hello"); err != nil {
		log.Fatalf("send error: %v", err)
	}
}
