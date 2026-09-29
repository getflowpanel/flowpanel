# @flowpanel/eslint-plugin

ESLint rules for FlowPanel configs: server imports in client components, destructive actions without a confirm, duplicate resource names, verbose filter options and common column-name typos.

## Install

```bash
pnpm add -D @flowpanel/eslint-plugin
```

## Example

```ts
// eslint.config.ts
import flowpanel from "@flowpanel/eslint-plugin";

export default [flowpanel.configs.recommended];
```

[Rules](https://flowpanel.tech/docs/reference/eslint-plugin) · MIT
