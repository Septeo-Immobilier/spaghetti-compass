package ports

import (
	"context"

	"github.com/example/app/internal/domain/invoice"
)

// InvoiceRepository defines the persistence contract for invoices.
type InvoiceRepository interface {
	Save(ctx context.Context, inv *invoice.Invoice) error
	FindByID(ctx context.Context, id string) (*invoice.Invoice, error)
}
