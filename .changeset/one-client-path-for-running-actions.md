---
"@flowpanel/next": minor
---

Run every action through one client path, and reject action forms the dialog
cannot serve.

The POST-decode-toast-refresh body existed four times — row, bulk, dashboard and
drawer — and the copies had drifted. `DashboardActionsBar` parsed the response
with a bare `res.json()`, so a 500 answered by a proxy in HTML threw a parse
error the operator saw as "Network error" instead of the status line the other
three showed. Row and bulk checked only `result.ok`, never `res.ok`, so a
transport failure carrying a non-JSON body reported the generic
`"<action> failed"` and hid the cause. Only the drawer honoured
`result.refresh === false`. One `useActionRunner` now serves all four.

`compileAdmin` refuses an action form field declaring a `reference` or
function-valued `options`. Action forms are serialized while the page renders, so
neither could be resolved: the field reached the dialog stripped of its lookup
and rendered a picker with nothing to pick. Failing at build time with a message
naming the field beats shipping a control that cannot be used.
