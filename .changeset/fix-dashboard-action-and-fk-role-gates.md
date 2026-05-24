---
"@flowpanel/next": patch
---

Close two role-gate gaps. Dashboard action routes now enforce the dashboard's
own `requireRole` before the per-action one, matching the page render and
preventing a privilege-escalation POST against a dashboard the caller can't
view. FK label resolution on list pages now honors the target resource's
`requireRole`, so a viewer lacking that role no longer sees the referenced
resource's `labelField` (the column falls back to the raw value).
