package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/example/app/internal/application/usecases"
)

// InvoiceHandler exposes HTTP endpoints for invoice operations.
type InvoiceHandler struct {
	receiveInvoice *usecases.ReceiveInvoice
}

// NewInvoiceHandler constructs an InvoiceHandler with the required use cases.
func NewInvoiceHandler(receiveInvoice *usecases.ReceiveInvoice) *InvoiceHandler {
	return &InvoiceHandler{receiveInvoice: receiveInvoice}
}

// receiveRequest is the JSON body for POST /invoices.
type receiveRequest struct {
	DocumentID string  `json:"documentId"`
	Amount     float64 `json:"amount"`
	Currency   string  `json:"currency"`
}

// ReceiveInvoice handles POST /invoices and delegates to the use case.
func (h *InvoiceHandler) ReceiveInvoice(w http.ResponseWriter, r *http.Request) {
	var req receiveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	input := usecases.ReceiveInvoiceInput{
		DocumentID: req.DocumentID,
		Amount:     req.Amount,
		Currency:   req.Currency,
	}

	if err := h.receiveInvoice.Execute(r.Context(), input); err != nil {
		http.Error(w, err.Error(), http.StatusUnprocessableEntity)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

// RegisterRoutes mounts the handler routes on mux.
func (h *InvoiceHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /invoices", h.ReceiveInvoice)
}
