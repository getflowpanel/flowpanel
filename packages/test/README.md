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
resource uses — and opens every other detail tab of the record page it reaches
as `?tab=<key>` (`tabs: false` keeps the pre-0.3.1 walk). It asserts that:

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
| `tabs` | `true` | Open every other detail tab of each record page reached. |

## Unit-test a widget

```ts
import { resolveWidget, widgetContext } from "@flowpanel/test/widgets";

const { props } = await resolveWidget(paidToday, widgetContext({ rows: { invoices } }));
expect(props.value).toBe(1);
```

`widgetContext` is the context your admin gives a widget, over rows you pass instead of a
database; `resolveWidget` returns the props the widget's card receives; `headerContext` is what
a record page hands `detail.title`, `subtitle` and `badge`, for a test that calls them. This entry is ESM-only
and needs `@flowpanel/kit`, which every FlowPanel app already has.

Vitest needs `vitest` itself (`pnpm add -D vitest`) plus two things beyond the default config: the
package inlined, or the first run fails with `ERR_MODULE_NOT_FOUND` for `next/cache`, and your
`@/` path alias resolved the way your app's bundler already resolves it — Vitest does not read
`tsconfig.json` on its own:

```ts
// vitest.config.ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { server: { deps: { inline: [/@flowpanel\//] } } },
});
```

## Documentation

<https://flowpanel.tech/docs/reference/testing>

## License

MIT
