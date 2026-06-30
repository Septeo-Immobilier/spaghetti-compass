# Quickstart: Support Go

**Feature Branch**: `003-go-language-support`
**Created**: 2026-06-30

Ce quickstart decrit le comportement attendu une fois la feature implementee.

## Fixture attendue

```text
fixtures/go/
├── go.mod
├── cmd/service/main.go
└── internal/
    ├── application/usecases/receive_invoice.go
    ├── domain/invoice/entity.go
    ├── handlers/invoice_handler.go
    └── ports/repository.go
```

## Explorer un fichier Go

```bash
spaghetti-compass explore fixtures/go/cmd/service/main.go -c fixtures/go
```

Resultat attendu:

- `main.go` est accepte comme entree.
- Les imports internes du module Go sont resolus vers `fixtures/go/internal/...`.
- Les imports standard library (`context`, `net/http`, etc.) ne sont pas resolus comme fichiers internes.
- La sortie garde les liens `path:line:column`.

## Explorer en JSON

```bash
spaghetti-compass explore fixtures/go/cmd/service/main.go -c fixtures/go --json
```

Checks utiles:

```bash
spaghetti-compass explore fixtures/go/cmd/service/main.go -c fixtures/go --json | jq '.nodes | length'
spaghetti-compass explore fixtures/go/cmd/service/main.go -c fixtures/go --json | jq '.edges[] | select(.resolved == true)'
```

## Explorer une methode Go

```bash
spaghetti-compass explore fixtures/go/internal/application/usecases/receive_invoice.go:ReceiveInvoice.Execute -c fixtures/go --json
```

Resultat attendu:

- La methode `ReceiveInvoice.Execute` est trouvee.
- Les appels directs du corps de methode sont presents comme edges `call`.
- Les appels vers des fonctions du meme fichier et des packages importes sont representes sans erreur.

Format alternatif accepte:

```bash
spaghetti-compass explore fixtures/go/internal/application/usecases/receive_invoice.go:ReceiveInvoice/Execute -c fixtures/go
```

## Analyse d'impact Go

```bash
spaghetti-compass impact fixtures/go/internal/domain/invoice/entity.go -c fixtures/go --json
```

Resultat attendu:

- Les fichiers qui importent directement le domaine apparaissent dans `directDependents`.
- Les fichiers transitivement impactes apparaissent dans `dependents`.
- Les handlers ou `cmd/**/main.go` apparaissent dans `routes` si les patterns route Go les couvrent.

## Validation locale

```bash
npm run test:run
npm run build
```

Optionnel si `gopls` est installe:

```bash
gopls version
spaghetti-compass explore fixtures/go/internal/application/usecases/receive_invoice.go -c fixtures/go --json
```
