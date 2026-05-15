# Security Policy

## Supported Versions

Active support for the latest minor of `flowpanel` and its peer packages.
Older minors receive critical-CVE patches for 6 months past the next
minor's release.

| Version line | Supported          |
| ------------ | ------------------ |
| 1.x.x        | ✅ Active          |
| 0.x.x        | ❌ End-of-life     |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security reports.**

Preferred channel: open a private security advisory on GitHub at
https://github.com/Ch4m4/flowpanel/security/advisories/new.

Alternative: email the maintainer (see the `flowpanel` package.json
`author` field for contact).

Include:

- Affected package name and version (e.g., `@flowpanel/next@1.0.3`).
- Reproduction steps — minimal repro repo, or paste a snippet.
- Expected vs. actual behavior.
- Your assessment of severity (low / medium / high / critical).

## Response Timeline

- **Acknowledgement**: within 72 hours of receiving the report.
- **Triage + fix plan**: within 7 days.
- **Critical fix shipped**: within 14 days of acknowledgement.
- **Coordinated disclosure**: preferred. We'll work with you on a
  disclosure date that gives users time to upgrade.

## Scope

In scope:

- Authentication / authorization bypass in `auth` and `scope` config
  paths.
- SSE channel leakage between users.
- Rate-limit bypass.
- Unsanitized data flowing from user input to a query (the adapter
  layer should guard against SQL injection, but reports are welcome).
- XSS in user-supplied strings rendered in admin chrome.
- Eject CLI writing files outside the project directory.

Out of scope:

- Vulnerabilities in user-supplied custom widgets or actions (those
  are user code).
- Vulnerabilities in upstream packages (drizzle, prisma, ioredis,
  bullmq, etc.) — please report directly to those projects, then file
  a corresponding issue here so we can pin patches.
- Self-XSS or social-engineering attacks not involving FlowPanel code.

Thank you for helping keep FlowPanel users safe.
