---
"@flowpanel/react": patch
---

Hide low-value Radix sub-primitives from the public `@flowpanel/react` surface: `DropdownMenuPortal`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, `SelectScrollDownButton`, `SelectScrollUpButton`. None were used internally or in the example; removing them keeps the v1.0 forever-contract focused on slots admin panels actually need. They can be re-added on demand under a minor bump if a real use case shows up.
