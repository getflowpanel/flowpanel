# @flowpanel/test

`smokeAdmin` walks a running FlowPanel admin in Playwright, opening every dashboard, list, first record and record tab, and fails on an HTTP error, a console error, an error card or, with `a11y`, an accessibility violation. `@flowpanel/test/widgets` unit-tests a widget over rows you pass.

## Install

```bash
pnpm add -D @flowpanel/test @playwright/test @axe-core/playwright
```

## Example

```ts
import { test } from "@playwright/test";
import { smokeAdmin } from "@flowpanel/test";

test("the admin is healthy", async ({ page }) => {
  await smokeAdmin(page, { paths: { admin: "/admin" }, a11y: true });
});
```

[Testing reference](https://flowpanel.tech/docs/reference/testing) · MIT
