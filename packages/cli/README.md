# @flowpanel/cli

CLI for FlowPanel. Scaffold, migrate, inspect, and debug your FlowPanel setup.

[![npm](https://img.shields.io/npm/v/@flowpanel/cli)](https://www.npmjs.com/package/@flowpanel/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/Ch4m4/flowpanel/blob/main/LICENSE)

## Usage

No installation required — use via `npx`:

```bash
npx flowpanel init
```

Or install globally:

```bash
npm install -g @flowpanel/cli
```

## Commands

| Command | Description |
|---------|-------------|
| `flowpanel init` | Scaffold config file and admin page |
| `flowpanel migrate` | Apply pending database migrations |
| `flowpanel migrate:status` | Show applied and pending migrations |
| `flowpanel doctor` | Health check — config, DB connection, auth |
| `flowpanel diff` | Show drift between config and database schema |
| `flowpanel status` | Quick status overview |
| `flowpanel demo` | Seed demo runs for development |
| `flowpanel dev` | Watch config with live validation |

## Documentation

[https://flowpanel.tech/docs/cli](https://flowpanel.tech/docs/cli)
