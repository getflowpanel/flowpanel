# @flowpanel/cli

## 0.3.0

### Minor Changes

- Added better-auth, NextAuth, Clerk and Lucia detection to `init`, which scaffolds the matching preset.
- Changed the scaffolded layout to forward a CSP nonce to `ThemeScript`.
- Changed `doctor` to print the config's warnings, also under `--json`.
- Fixed the `init` install step on Windows.

## 0.2.0

### Minor Changes

- Changed `init`, `doctor`, `migrate` and `new` to scaffold the code the documentation teaches.
- Changed a kit and CLI version mismatch to a hard stop.
- Fixed a dry run touching the database.

## 0.1.0

First public release. The FlowPanel CLI: `init`, `dev`, `migrate`, `doctor`, `eject`, and `new`.
