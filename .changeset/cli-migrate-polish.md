---
"@flowpanel/cli": patch
---

`flowpanel migrate` now uses `@clack/prompts` intro + outro for visual consistency with `init` / `eject` / `new`. `flowpanel doctor` hints for auto-fixable file checks now suggest `flowpanel doctor --fix` (which actually fixes them) instead of `flowpanel init` (which re-prompts the user).
