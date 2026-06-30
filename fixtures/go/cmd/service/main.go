package main

import (
	"context"
	"log"
	"net/http"

	"github.com/example/app/internal/application/usecases"
	"github.com/example/app/internal/domain/invoice"
	"github.com/example/app/internal/handlers"
	"github.com/example/app/internal/ports"
)

func main() {
	repo := newInMemoryRepository()

	receiveInvoice := usecases.NewReceiveInvoice(repo)

	invoiceHandler := handlers.NewInvoiceHandler(receiveInvoice)

	mux := http.NewServeMux()
	invoiceHandler.RegisterRoutes(mux)

	log.Println("starting server on :8080")
	if err := http.ListenAndServe(":8080", mux); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

// inMemoryRepository is a trivial in-process implementation of ports.InvoiceRepository,
// used exclusively for local development and fixture exploration.
type inMemoryRepository struct {
	store map[string]*invoice.Invoice
}

// newInMemoryRepository returns a ports.InvoiceRepository backed by an in-memory map.
func newInMemoryRepository() ports.InvoiceRepository {
	return &inMemoryRepository{store: make(map[string]*invoice.Invoice)}
}

func (r *inMemoryRepository) Save(_ context.Context, inv *invoice.Invoice) error {
	r.store[inv.ID] = inv
	return nil
}

func (r *inMemoryRepository) FindByID(_ context.Context, id string) (*invoice.Invoice, error) {
	inv, ok := r.store[id]
	if !ok {
		return nil, nil
	}
	return inv, nil
}
