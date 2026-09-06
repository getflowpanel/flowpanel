---
"@flowpanel/core": patch
"@flowpanel/react": patch
---

Honor configured labels in filters, pagination and the command palette, including
accessible names. Add optional filter and page-number strings. Explicit component
placeholders retain precedence, including empty strings; undefined configuration
values no longer erase defaults. All select filters now share `allOption` (English
fallback `All`), and pagination defaults match its existing accessible page names.
