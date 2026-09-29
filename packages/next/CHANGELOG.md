# @flowpanel/next

## 0.3.0

### Minor Changes

- Added related tabs that resolve reference labels, paginate, sort and link to the full list.
- Added widgets inside detail tabs.
- Added a warning in `defineAdmin` when a create form cannot satisfy a required column.
- Added `data-fp-error` to every error surface.
- Changed row clicks to open the detail page.
- Changed validation messages to come from `labels.form`.
- Changed a failed adapter read to show an error card with a request id instead of the host error page.

## 0.2.0

### Minor Changes

- Changed the JSON API, pages and action routes to share one set of guards, so access, filters, pagination and errors agree.
- Changed the drawer to open and switch tabs without a server round-trip.
- Fixed writes from an admin behind a reverse proxy.

## 0.1.0

First public release. The Next.js App Router integration: the admin page component, API route handlers, server-rendered list/detail/dashboard pages, drawers, server actions (row / bulk / dashboard / inline), and SSE realtime.
