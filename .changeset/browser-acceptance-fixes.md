---
"flowpanel": patch
"@flowpanel/next": patch
"@flowpanel/react": patch
---

Three runtime fixes surfaced by the browser acceptance pass against
freelance-radar. No public API shape changes — existing exports keep
the same signatures.

- **DashboardActionsBar now opens the form modal.** A `DashboardAction`
  with a non-empty `form: [...]` no longer POSTs an empty body the
  instant its button is clicked. The serialized action carries the form
  schema (`SerializedDashboardActionField[]`); the bar opens a modal
  with the rendered fields, and submits the collected values as the
  action's `input`. `confirm: { title, description }` composes with
  `form` — when both are set, the confirm copy renders at the top of
  the form dialog instead of stacking a second modal.
- **MobileCardList no longer nests `<button>` inside `<button>`.** The
  outer card wrapper is now a `<div role="button" tabIndex={0}>` with
  Enter/Space keyboard activation, so the row-actions kebab (which is
  itself a real `<button>`) is legal HTML. Outer wrapper still matches
  `getByRole("button")` for tests / a11y trees.
- **`Flowpanel()` recognises any catch-all param name.** Previously the
  page read `params.slug` only; mounting under `app/admin/[[...rest]]/page.tsx`
  caused every URL to silently render the dashboard root. The page now
  prefers `slug`, then `rest`, then the first `string[]` value in
  `params` — so `[[...rest]]`, `[[...slug]]`, or any other identifier
  all route correctly.
