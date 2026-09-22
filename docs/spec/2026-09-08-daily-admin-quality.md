# Daily admin quality contract

The user authorized autonomous decisions and implementation of the remaining
quality plan. This iteration closes observable gaps in everyday investigation:
configured language must cover navigation, table chrome, saved views and dates;
related history must have a path beyond the first 50 records.

## Framework

- Extend existing LabelsConfig with optional navigation, table, savedViews and
  dateRange groups. Add a complete, plain-string RU_LABELS preset exported from
  the existing browser-safe labels entry and kit. Keep all English fallbacks and
  preserve explicit component overrides. Host-specific entity/action names stay
  application-owned.
- Calendar formatting uses explicit dateRange.locale (default en-US, Russian
  preset ru-RU), consistently on server and client. Translate presentation only;
  preset keys and YYYY-MM-DD range encoding remain unchanged. Keep local-calendar
  semantics rather than introducing an unrelated timezone API.
- Saved views display configured copy and accessible input labels. A failed
  localStorage write produces an actionable error and keeps the unsaved form;
  never report success for a failed write. Existing view URL/filter semantics
  remain unchanged.
- Sidebar/tab navigation keeps the most specific matching destination active on
  detail pages; paths are segment-aware, so /user does not match /user_profile.
- Verify real primitive interactions, deterministic server rendering, default
  language and overrides. Do not turn source-string matching into the sole proof.

## Host

- Adopt reviewed frozen packages and the RU preset; keep project-specific terms.
- Bounded history panels clearly say they are previews and link to the existing
  paginated resource with an explicitly declared userId filter. Never expose
  credentials/session tokens when extending access history.
- Use advisory UX findings to keep navigation changes coherent; retain old tab
  URLs and role/access guards. No host data mutation merely to prove a view.
- Validate source with isolated synthetic contracts, then read-only browser QA
  against the authorized session. Production build uses isolated, non-sending
  environment; never stop the user's server.

## Delivery

One writer at a time. Framework changes get independent code review. Host changes
use its frontend/backend role routing and a fresh independent reviewer. Apply to
the user's branch only after PASS. Keep releases local; external publication is
not part of this iteration. Broader architecture findings are triaged separately
from this contract, with concrete regression evidence before implementation.
