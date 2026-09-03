# @flowpanel/core

## 0.2.0

### Minor Changes

- 2804944: The config surface now declares only what the runtime reads: options and public API that no surface reached are gone, and `auth.session` receives the request. Column formatting and the fail-closed scope rule each have one definition instead of a copy per package.

## 0.1.0

First public release. Core types and runtime for FlowPanel: `defineAdmin`, the `resource` / `dashboard` / widget builders, and the runtime for tenant scope, role gates, audit, and rate limiting.
