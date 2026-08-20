package notify

// marker is an internal constant referenced by nothing else in the package or module.
// It exists to reproduce the package-vs-file asymmetry: this file sorts alphabetically
// first among the package's non-test files, so a resolver that treats "the first file"
// as the package's sole reverse-dependency anchor would wrongly attribute all of the
// package's external dependents to this file and none to sender.go.
const marker = "notify-marker"
