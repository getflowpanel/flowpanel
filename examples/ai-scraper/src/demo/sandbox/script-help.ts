export const RESET_DEMO_HELP = `Reset one FlowPanel demo sandbox.

Usage:
  pnpm demo:reset -- --sandbox local
  pnpm demo:reset -- --sandbox <public-uuid>

The default is --sandbox local. The command restores only that sandbox and never touches another
visitor's rows.`;

export const CLEANUP_DEMO_HELP = `Delete expired FlowPanel demo sandboxes.

Usage:
  pnpm demo:cleanup -- [--force]

Without --force, PostgreSQL's maintenance claim limits cleanup frequency. --force performs the
expired sandboxes pass immediately; live sandboxes are never removed.`;
