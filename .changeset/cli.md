---
"@flowpanel/cli": minor
---

`init` recognises better-auth, NextAuth, Clerk and Lucia and scaffolds the matching preset; the scaffolded layout forwards a CSP nonce to `ThemeScript`. `doctor` prints the config's warnings, also under `--json`. On Windows, `init` runs the package manager through the shell Node requires for `.cmd` shims, so the install step works there.
