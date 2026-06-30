package invoice

import (
	"time"

	"github.com/google/uuid"
)

// Invoice represents a billing invoice in the domain.
type Invoice struct {
	ID         string
	DocumentID string
	Amount     float64
	Currency   string
	IssuedAt   time.Time
	Status     string
}

// NewInvoice creates a new Invoice with a generated ID and the given document reference.
func NewInvoice(documentID string, amount float64, currency string) *Invoice {
	return &Invoice{
		ID:         uuid.NewString(),
		DocumentID: documentID,
		Amount:     amount,
		Currency:   currency,
		IssuedAt:   time.Now(),
		Status:     "pending",
	}
}

// Validate checks that the invoice satisfies basic domain invariants.
func (inv *Invoice) Validate() error {
	if inv.DocumentID == "" {
		return ErrEmptyDocumentID
	}
	if inv.Amount <= 0 {
		return ErrNonPositiveAmount
	}
	return nil
}

// MarkPaid transitions the invoice status to paid.
func (inv *Invoice) MarkPaid() {
	inv.Status = "paid"
}

// DomainErrors exposes typed sentinel errors for this package.
var (
	ErrEmptyDocumentID  = domainError("invoice: document ID must not be empty")
	ErrNonPositiveAmount = domainError("invoice: amount must be positive")
)

type domainError string

func (e domainError) Error() string { return string(e) }
