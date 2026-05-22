import rule from "../audit-row-action-needs-confirm.js";
import { ruleTester } from "./setup.js";

ruleTester().run("audit-row-action-needs-confirm", rule, {
  valid: [
    {
      name: "destructive row action with confirm",
      code: `
        const config = {
          actions: [
            { key: "delete", label: "Delete", variant: "destructive", confirm: "Sure?", run: async () => {} },
          ],
        };
      `,
    },
    {
      name: "destructive bulk action with confirm object",
      code: `
        const config = {
          bulkActions: [
            { key: "wipe", label: "Wipe", variant: "destructive", confirm: { title: "Wipe?" }, run: async () => {} },
          ],
        };
      `,
    },
    {
      name: "non-destructive action does not require confirm",
      code: `
        const config = {
          actions: [
            { key: "ping", label: "Ping", run: async () => {} },
          ],
        };
      `,
    },
    {
      name: "primary variant is not destructive",
      code: `
        const config = {
          actions: [
            { key: "go", label: "Go", variant: "primary", run: async () => {} },
          ],
        };
      `,
    },
  ],
  invalid: [
    {
      name: "destructive row action missing confirm",
      code: `
        const config = {
          actions: [
            { key: "delete", label: "Delete", variant: "destructive", run: async () => {} },
          ],
        };
      `,
      errors: [{ messageId: "needsConfirm", data: { kind: "row" } }],
    },
    {
      name: "destructive bulk action missing confirm",
      code: `
        const config = {
          bulkActions: [
            { key: "wipe", label: "Wipe", variant: "destructive", run: async () => {} },
          ],
        };
      `,
      errors: [{ messageId: "needsConfirm", data: { kind: "bulk" } }],
    },
    {
      name: "reports each offending entry independently",
      code: `
        const config = {
          actions: [
            { key: "a", label: "A", variant: "destructive", run: async () => {} },
            { key: "b", label: "B", variant: "destructive", confirm: "ok", run: async () => {} },
            { key: "c", label: "C", variant: "destructive", run: async () => {} },
          ],
        };
      `,
      errors: [{ messageId: "needsConfirm" }, { messageId: "needsConfirm" }],
    },
  ],
});
