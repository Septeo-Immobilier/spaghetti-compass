# Go resolution: the two-binary prerequisite, and how to tell it is working

Read this before a precision-sensitive `explore` on `.go`. It concerns **`explore` only** — `impact` starts no language server in any language, so nothing here changes an `impact` answer (see the main SKILL.md, "Reading an empty answer on Go").

Everything below was measured on 2026-09-22, spaghetti-compass 1.1.3, macOS arm64, against `modelo-broker-pa` — a Go 1.25 modular monolith.

## 1. `gopls` alone resolves nothing. It needs `go` on the same PATH.

This is the finding that costs the most time, because nothing reports it.

Same command, four PATH configurations:

```bash
spaghetti-compass explore \
  apps/backend/internal/infrastructure/http/handlers/ingeneo_events_webhook.go:IngeneoEventsWebhook.dispatch \
  -c apps/backend -d 6 --json
```

| PATH contains | nodes | edges | **resolved** |
|---|---|---|---|
| neither | 15 | 13 | **1** |
| `go` only | 15 | 13 | **1** |
| `gopls` only | 15 | 13 | **1** |
| **both** | **31** | **49** | **49** |

What was measured is the table: with `gopls` present and `go` absent, the output is indistinguishable from having no language server at all. The explanation — gopls relies on the Go toolchain to load the package graph, so it can answer nothing without it — was not separately instrumented here; treat it as the reason, not as a second observation.

`doctor` cannot see this. It prints `OK gopls` from PATH presence alone, so a host with `gopls` and no `go` reports a green row while resolution sits at 1 edge in 13. Its own remediation line is the tell:

```
MISS gopls                install with: go install golang.org/x/tools/gopls@latest
```

That command is itself impossible without `go`.

**A second way `doctor` misleads**: it printed `OK gopls` for a **Linux** gopls binary placed in `~/.local/bin` on macOS, which cannot execute at all (`cannot execute binary file`). The row means "a file of that name is on the PATH", never "it runs".

So before trusting a Go `explore`, run both, and read the output rather than the exit code:

```bash
go version && gopls version
```

## 2. Judge the effect by `resolved`, never by `nodes`

A node count is the intuitive thing to compare across a control run, and it is the wrong one.

Second entry point, `apps/backend/internal/infrastructure/signature/preamble.go:CheckPreamble`, same repository:

| | nodes | edges | **resolved** |
|---|---|---|---|
| gopls unreachable | 22 | 26 | **4** |
| gopls reachable | 20 | 25 | **24** |

The node count *fell*, because text-matched false candidates drop out once real resolution takes over. A reader watching nodes would conclude the language server does nothing. Resolution went from 15 % to 96 %.

It also changes in kind, not only in degree. Without gopls, only targets **inside the entry file** resolve. With it, the graph crosses files (`signature/errors.go:NewWebhookError`) and resolves methods on types (`Nonces.Check`, `Nonces.Save`).

The one line to run on any `--json` output:

```bash
jq -r '"nodes=\(.nodes|length) edges=\(.edges|length) resolved=\([.edges[]|select(.resolved)]|length)"' out.json
```

This sharpens the control-run rule in the bug-report section of the main SKILL.md: "byte-identical output" is the correct bar, and a node count is not a proxy for it.

## 3. Two tells that gopls really ran

**A resolved target inside the toolchain.** With gopls working, at least one edge resolves into the standard library under the Go installation itself, for example:

```
/opt/homebrew/Cellar/go/1.27.1/libexec/src/builtin
```

A parser fallback cannot produce that path. This is the cheapest check, and it needs no timing.

**The live process**, if you want to see it:

```bash
ps -axo pid,comm | awk '$2 ~ /\/gopls$/ {print}'
```

Match on `comm`, the executable name — **not** `ps -axww | grep gopls`, which matches your own polling command line and returns a false positive every time. The process appears roughly 0.4 s into the run and exits with it, so a one-second poll interval misses it entirely and reads as "gopls never ran".

## 4. Installing both, on a host that has neither

Verified end to end on macOS:

```bash
brew install go                                # 1.27.1
go install golang.org/x/tools/gopls@latest     # v0.23.0
fish_add_path -U $HOME/go/bin                  # bash/zsh: add ~/go/bin to PATH
```

Two traps, each measured:

- **`go install` targets `GOBIN`**, which defaults to `~/go/bin`. That directory is frequently absent from the PATH even when Homebrew's `bin` is present — which is exactly the "`gopls` installed, still `MISS`" shape.
- **In fish, `fish_add_path -g` does nothing durable.** It sets a shell-local global; `$fish_user_paths` comes back unchanged and the next shell cannot find `gopls`. Use `-U`.

**A version worry that is not one.** Go publishes no LTS; upstream supports the two most recent majors. A 1.27 toolchain against a module whose `go.mod` says `go 1.25.0` is correct — that directive is a floor, not a pin.

## 5. Docker

The `node:20` image the main SKILL.md uses for the `npx` form carries **neither** binary. Checked directly, same day:

```console
$ docker run --rm node:20 sh -c 'command -v go; command -v gopls'
go: ABSENT
gopls: ABSENT
```

That is the "neither" row of §1, so a Go `explore` run through Docker is fully degraded. The conclusion is an inference from the measured absence, not a second measurement taken inside the container.

For Go specifically, then, the host binary is not merely faster — it is the only form that resolves, unless the image is rebuilt with both. `impact` is unaffected either way.
