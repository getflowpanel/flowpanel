# Labels consistency: acceptance contract

The configured admin language must reach the components that render it. The
FreelanceRadar audit found English filter sentinels and pagination even though
`labels.allOption` and `labels.pagination` were configured in Russian.

This follow-up connects the existing labels provider to filters, pagination and
the command palette. Additional optional strings cover their accessible names,
boolean choices, loading state and page-number templates. Standalone pagination
remains a pure renderer; its registry wrapper supplies labels as ordinary props.
Explicit component props take precedence, including intentionally empty strings.
An undefined configuration property keeps its default instead of erasing it.

Acceptance:

- Russian filter labels are visible with real primitives; choosing an option
  still emits the original query value, clearing emits null.
- Pagination's accessible names and size picker use configured strings; page
  and page-size callbacks keep their numeric contracts. Custom registry slots
  receive the same labels. The pure default also works without a provider.
- Palette search, empty state, loading state and accessible dialog text use
  configured labels; item selection and search callbacks still work.
- Undefined overrides keep defaults; explicit empty strings survive merging and
  component forwarding. English remains the fallback language.
- No changes to filter encoding, database queries or date-range semantics.

Verification: targeted RED/GREEN DOM tests, core merge tests, complete core/React
unit tests, typecheck and lint, independent review, then packed host adoption.
Date-picker presets, saved views and remaining shell strings are separate
follow-ups; this document does not claim complete localization.
