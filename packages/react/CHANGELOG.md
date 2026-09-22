# @flowpanel/react

## 0.3.0

### Minor Changes

- 072f37b: Cards for the new widgets, a dashboard freshness stamp, headers that wrap on narrow screens, a pager that shows its range and a drawer link to the record page. The reference picker no longer depends on `cmdk`, taking the UI bundle from 72.3 kB to 69.6 kB brotli. `formatNumber` takes the resolved `formatting`; a locale string still works.

### Patch Changes

- Updated dependencies [072f37b]
  - @flowpanel/core@0.3.0

## 0.2.0

### Minor Changes

- 2804944: Field types render the control their name promises, and helpers that existed in several copies now have one implementation.

### Patch Changes

- Updated dependencies [2804944]
  - @flowpanel/core@0.2.0

## 0.1.0

First public release. UI primitives for FlowPanel — shadcn-style components on Radix + Tailwind v4 with design tokens: the admin shell, data table, forms, feedback, and dashboard widgets.
