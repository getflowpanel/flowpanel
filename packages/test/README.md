# @flowpanel/test

The smoke test every admin needs, as one Playwright call.

[![npm](https://img.shields.io/npm/v/@flowpanel/test.svg)](https://www.npmjs.com/package/@flowpanel/test)

> Install it as a dev dependency. It is not part of `@flowpanel/kit` and never
> ships in your application bundle.

## Install

```sh
pnpm add -D @flowpanel/test @playwright/test
# optional, enables the accessibility assertions
pnpm add -D @axe-core/playwright
```

## Use

```ts
import { test } from "@playwright/test";
import { smokeAdmin } from "@flowpanel/test";

test("the admin is healthy", async ({ page }) => {
  await smokeAdmin(page, { basePath: "/admin", a11y: true });
});
```

`smokeAdmin` walks the admin's navigation (`[data-flowpanel-nav]`, which every
shell mode renders), opens every dashboard and resource list it links to, opens
the first row of each list — the row's own page or its drawer, whichever that
resource uses — and asserts that:

- the navigation yielded at least one route to walk,
- every navigation answers with a status below 400,
- nothing wrote to `console.error`,
- no page rendered a FlowPanel error surface (`[data-fp-error]`),
- with `a11y`, axe reports zero WCAG 2.2 AA violations per visited route.

It resolves with a `SmokeAdminReport` and throws an `Error` carrying that
report when anything failed.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `basePath` | `"/admin"` | Where the admin is mounted. |
| `cookie` | — | Session cookie added before the walk. |
| `resources` | every nav entry | Nav segments to restrict the walk to. |
| `a11y` | `false` | Run axe on every visited route. |
| `maxRows` | `1` | Rows of each list to open. |

## Documentation

<https://flowpanel.tech/docs/reference/testing>

## License

MIT
