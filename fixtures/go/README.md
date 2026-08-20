# Go Test Fixture

Mini Go module for testing spaghetti-compass with gopls.

## Requirements

- Go 1.21+ (for parsing only; the module does not need to compile in CI)
- Optional gopls for full LSP navigation: `go install golang.org/x/tools/gopls@latest`

## Structure

```
go/
├── go.mod
├── cmd/
│   ├── service/
│   │   └── main.go                          # Entry point — wires handlers + use cases
│   └── notifier/
│       └── main.go                          # Entry point - calls notify.NewSender (route pattern **/cmd/**/main.go)
└── internal/
    ├── application/usecases/
    │   └── receive_invoice.go               # ReceiveInvoice use case (Execute method)
    ├── domain/invoice/
    │   └── entity.go                        # Invoice aggregate + NewInvoice constructor
    ├── handlers/
    │   └── invoice_handler.go               # HTTP handler (route pattern **/*handler.go)
    ├── notify/
    │   ├── aaa_marker.go                    # Sorts first alphabetically; referenced by nothing
    │   └── sender.go                        # Sorts second; holds the Sender constructor cmd/notifier calls
    └── ports/
        └── repository.go                    # InvoiceRepository interface
```

## Test Commands

```bash
# Explore the entry point
spaghetti-compass explore fixtures/go/cmd/service/main.go -c fixtures/go

# JSON output — check resolved edges
spaghetti-compass explore fixtures/go/cmd/service/main.go -c fixtures/go --json | jq '.edges[] | select(.resolved == true)'

# Explore the Execute method
spaghetti-compass explore fixtures/go/internal/application/usecases/receive_invoice.go:ReceiveInvoice.Execute -c fixtures/go --json

# Impact analysis from the domain entity
spaghetti-compass impact fixtures/go/internal/domain/invoice/entity.go -c fixtures/go --json
```

## Expected Results

When analysing `ReceiveInvoice.Execute`, you should see call edges to:
- `normalizeDocument` (same file helper)
- `invoice.NewInvoice` (domain constructor in `internal/domain/invoice/entity.go`)
- `inv.Validate` (method on `*invoice.Invoice`)
- `uc.repo.Save` (repository port call)

When running impact on `entity.go`, the transitive chain is:
```
entity.go
  <- internal/ports/repository.go
  <- internal/application/usecases/receive_invoice.go
     <- internal/handlers/invoice_handler.go
        <- cmd/service/main.go
```

### `internal/notify` - package-vs-file asymmetry fixture

`internal/notify` has two non-test files: `aaa_marker.go` (sorts first alphabetically,
declares a constant referenced by nothing) and `sender.go` (sorts second, declares the
`Sender` constructor that `cmd/notifier/main.go` calls). Both files belong to the same
Go package, so both must report the same dependents.

Before the truthfulness fix, import resolution attributed the whole package's reverse
edge to whichever file sorted first, producing an asymmetric result:
```
impact fixtures/go/internal/notify/sender.go -c fixtures/go       # 0 dependent(s), 0 route(s)
impact fixtures/go/internal/notify/aaa_marker.go -c fixtures/go   # 1 dependent(s), 1 route(s)
```

After the fix, both files report the same non-empty set, both containing
`cmd/notifier/main.go`:
```
impact fixtures/go/internal/notify/sender.go -c fixtures/go
impact fixtures/go/internal/notify/aaa_marker.go -c fixtures/go
```
