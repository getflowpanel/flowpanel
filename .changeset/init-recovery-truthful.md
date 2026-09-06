---
"@flowpanel/cli": patch
---

`init` reports every reason it is incomplete, not only packages that failed to
resolve. A dependency that installs but cannot work with this CLI is now listed
in `failed` with its own recovery command, in the human outro and in `--json`.

A project-local `@flowpanel/cli` is accepted when it shares this CLI's minor, the
same rule the kit already uses, so a matching patch or preview no longer fails a
correct project. A differing minor names both versions and offers two ways out.

The installer re-checks each remaining package before running another command:
one plain `install` commonly resolves everything, and the second command is now
skipped instead of re-adding a package the first one installed. Declared
`workspace:`, `file:` and range specifiers keep running `install` and are never
replaced by a pinned add.

Installed packages are found again in a hoisted npm, yarn or bun workspace: the
resolver follows Node's own search path through ancestor `node_modules` instead
of stopping at the project directory. A Yarn PnP-only layout now says that the
layout is unsupported, and how to leave it, instead of blaming a package version.

A package manager that exits non-zero over an unrelated package no longer makes
init report itself incomplete with nothing named and nothing to run. It reports
what the manager said as a warning and succeeds, because FlowPanel's own packages
are installed. A peer-only declaration is added rather than left to a plain
install that can never resolve it, and an installed package whose manifest cannot
be read is described as such instead of as missing.

`doctor` keeps checking for duplicate `@flowpanel/core` installations when one
unreadable manifest is present, and its TypeScript hint names a runnable command
again.

A PnP layout is only reported when `.pnp.cjs` sits beside a manifest at this
project's own install root, and only as the explanation for a failure it caused,
so a stray `.pnp.cjs` further up the filesystem cannot mask a missing dependency.
A piped run without `--json` prints the manager's unrelated error too, instead of
finishing silently, and a version mismatch explains itself rather than deferring
to an unrelated install error.

Diagnostics redact a credential printed outside a query string, such as a bare
`_authToken=` or a quoted `"password"` field in package manager output.
