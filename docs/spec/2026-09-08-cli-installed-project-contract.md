# Trustworthy CLI project diagnostics

Confirmed audit defects: version parsing takes the first number from a declared
range; `init` calls declarations installed dependencies; failed dependency
installation has no actionable JSON reason; doctor repair assumes the default
API mount. These are separate from the already-reviewed Next route collision
and reachable pnpm core graph fixes, which must remain protected.

## Installed compatibility and init lifecycle

1. Resolve package manifests from the consumer using Node's package search paths
   and realpaths without executing application/package code. Reuse the installed
   core scanner's resolution approach. Distinguish declared specifier, installed
   exact version and missing/unresolvable package. Support hoisted and pnpm
   layouts; do not count stale unreachable store entries.
2. Use actual semver evaluation of installed versions and published support
   contracts. Current contracts are Node >=20, Next ^16.3, React/ReactDOM ^19,
   Drizzle >=0.45.2 <1, Prisma >=5 <7. Tailwind is precompiled into the default
   FlowPanel stylesheet and is not a prerequisite or peer dependency. Also respect installed Next's
   Node engine requirement. TypeScript must be installed for generated TS;
   document tested versions rather than inventing an unsupported minimum.
   Declared tags, ranges, aliases and workspace/file specs are not installed
   exact versions. Never silently upgrade Next, React or the host ORM.
3. Both init and doctor use the same compatibility findings. Unsupported or
   missing prerequisite runtimes produce concrete package/observed/required/
   recovery information before init writes files. Dry-run/JSON stay read-only
   and never connect to the database.
4. Required FlowPanel kit/CLI entries are resolved after installation. If a
   declared dependency is unresolved, install using the consumer's existing
   specification/lockfile rather than replacing it with a registry latest.
   Genuinely absent entries use the existing version-pinned add path. A package
   manager exit zero alone cannot certify readiness if required packages remain
   missing or incompatible. Preserve workspace/file pins and project scripts.
5. JSON contains a structured install outcome including a bounded, redacted
   reason, attempted command and practical recovery. Report files applied and
   dependency failure separately; do not promise filesystem rollback after a
   package-manager failure. Human output explains the same state concisely.
   Never print credentials from package-manager errors or environment values.
6. Preserve cancellation, NO_COLOR/non-TTY readability, JSON stdout purity,
   repeat-init no-op and existing mount collision behavior. Display the actual
   package-manager dev command and configured admin path without promising an
   unobserved running port. No automatic dev server or migration execution.

## Custom API mount doctor

Read static paths.admin and paths.api consistently through existing supported
config/re-export patterns. Checks, collision detection and repair all use those
mounts. An unresolved dynamic API expression is unknown, not permission to write
default routes. Repair refuses affected operations and explains the manual
next step. Preserve unrelated routes and do not create a second default API
when a custom API already exists.

## Evidence and delivery

Use distinct reviewed commits for installed compatibility/lifecycle and API
mount repair. RED/GREEN: declared-supported but installed-unsupported Next;
declared-but-missing FlowPanel; hoisted manifests; missing TS/React; prerelease
and nontrivial declared specs; install failure and zero-exit unresolved packages;
JSON/cancellation/no-write preflight. Test custom admin+API with default paths
absent, dynamic config and collisions. Update manifest-only test fixtures to
contain actual package manifests where the scenario claims installation;
do not weaken the previous route or package-graph protection.

Run full CLI tests/typecheck/build/lint/docs/reference checks, packed npm/pnpm
Next installation smoke, and read-only doctor on the existing FreelanceRadar
checkout. No publishing, host dependency upgrades or host migrations.
