# @flowpanel/cli

The `flowpanel` command: `init` adds FlowPanel to a Next.js app, `new` adds resources, `migrate` creates the audit tables, `doctor` checks the wiring, `eject` hands a page to your code, and `dev` runs Next.js with the queue board.

## Install

```bash
pnpm dlx @flowpanel/cli init
```

`init` installs the CLI as a dev dependency, so later commands run as `pnpm flowpanel <command>`.

## Example

```bash
pnpm flowpanel new customers --dir src/admin/config/resources
pnpm flowpanel migrate --dry-run
pnpm flowpanel doctor --fix
```

[CLI reference](https://flowpanel.tech/docs/reference/cli) · MIT
