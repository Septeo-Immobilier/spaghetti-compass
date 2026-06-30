package usecases

import (
	"context"
	"strings"

	"github.com/example/app/internal/domain/invoice"
	"github.com/example/app/internal/ports"
)

// ReceiveInvoiceInput carries the data required to receive a new invoice.
type ReceiveInvoiceInput struct {
	DocumentID string
	Amount     float64
	Currency   string
}

// ReceiveInvoice is the use case for receiving and persisting a new invoice.
type ReceiveInvoice struct {
	repo ports.InvoiceRepository
}

// NewReceiveInvoice constructs a ReceiveInvoice use case with the given repository.
func NewReceiveInvoice(repo ports.InvoiceRepository) *ReceiveInvoice {
	return &ReceiveInvoice{repo: repo}
}

// Execute validates, normalises, and persists a new invoice.
// It makes at least two direct calls:
//  1. normalizeDocument — local helper that sanitises the document ID.
//  2. invoice.NewInvoice — domain constructor that builds the aggregate.
//  3. uc.repo.Save     — persistence port that stores the aggregate.
func (uc *ReceiveInvoice) Execute(ctx context.Context, input ReceiveInvoiceInput) error {
	normalizedID := normalizeDocument(input.DocumentID)

	inv := invoice.NewInvoice(normalizedID, input.Amount, input.Currency)

	if err := inv.Validate(); err != nil {
		return err
	}

	return uc.repo.Save(ctx, inv)
}

// normalizeDocument trims whitespace and upper-cases the document identifier.
func normalizeDocument(raw string) string {
	return strings.ToUpper(strings.TrimSpace(raw))
}
