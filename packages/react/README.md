# @flowpanel/react

React UI for FlowPanel. Mount `<FlowPanelUI>` to get a full admin dashboard — run log, metrics, stage breakdown, drawers, and live updates.

[![npm](https://img.shields.io/npm/v/@flowpanel/react)](https://www.npmjs.com/package/@flowpanel/react)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/Ch4m4/flowpanel/blob/main/LICENSE)

## Installation

```bash
npm install @flowpanel/react @flowpanel/core
```

## Usage

```tsx
import { FlowPanelUI } from "@flowpanel/react";
import { flowpanel } from "./flowpanel";

export default function AdminPage() {
  return <FlowPanelUI config={flowpanel.config} />;
}
```

The component connects to the tRPC API automatically. Pass `trpcBaseUrl` if the API is mounted at a non-default path:

```tsx
<FlowPanelUI config={flowpanel.config} trpcBaseUrl="/api/flowpanel" />
```

## Documentation

[https://flowpanel.tech/docs/ui](https://flowpanel.tech/docs/ui)
