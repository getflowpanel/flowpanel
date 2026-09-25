---
"@flowpanel/cli": patch
---

The admin layout `init` writes into a host with its own root layout renders `ThemeScript` with the `x-nonce` header, so the theme applies before hydration there too.

`flowpanel new <table> --dir <dir> [--hidden]` writes the resource as its own file — columns chosen by type, an `enumOf` stub per enum, a `reference` per foreign key, composite keys included — and adds it to `<dir>/index.ts`. A root config that only re-exports another module is followed through the tsconfig paths, and a config whose `resources` is imported is no longer given a second `resources` key.

`--dir` now accepts an absolute path, not just one relative to the current directory. `--json` reports an unlinked foreign key as `{ table, column }`. The schema check behind `flowpanel new` verifies a bare `@/…` import against `src/` and the project root again on a host with no tsconfig `paths`, as it did before `--dir` shipped.
