# @flowpanel/cli

## 0.3.0

### Minor Changes

- 072f37b: `init` recognises better-auth, NextAuth, Clerk and Lucia and scaffolds the matching preset; the scaffolded layout forwards a CSP nonce to `ThemeScript`. `doctor` prints the config's warnings, also under `--json`. On Windows, `init` runs the package manager through the shell Node requires for `.cmd` shims, so the install step works there.

## 0.2.0

### Minor Changes

- 2804944: `init`, `doctor`, `migrate` and `new` scaffold the code the documentation teaches, and a dry run no longer touches the database. A kit and CLI version mismatch is now a hard stop.

## 0.1.0

First public release. The FlowPanel CLI: `init`, `dev`, `migrate`, `doctor`, `eject`, and `new`.
