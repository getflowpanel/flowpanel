# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in FlowPanel, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email: security@flowpanel.dev
3. Include: description, reproduction steps, impact assessment

We will acknowledge receipt within 48 hours and provide a timeline for a fix.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.x     | Yes       |

## Security Features

FlowPanel includes built-in security:

- **Authentication** — pluggable session-based auth
- **Role-based access** — configurable per-role permissions
- **Row-level security** — filter data by user context
- **Rate limiting** — per-user, per-endpoint throttling
- **Audit logging** — all mutations logged with user context
- **Field redaction** — sensitive fields masked in error output
- **SQL injection prevention** — all queries parameterized
