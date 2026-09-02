import rule from "../prefer-shorthand-filter";
import { ruleTester } from "./setup";

ruleTester().run("prefer-shorthand-filter", rule, {
  valid: [
    {
      name: "string-array shorthand is already used",
      code: `
        const config = {
          filters: [
            { key: "status", type: "select", options: ["active", "archived"] },
          ],
        };
      `,
    },
    {
      name: "label !== value — cannot collapse",
      code: `
        const config = {
          filters: [
            {
              key: "status",
              type: "select",
              options: [
                { label: "Active", value: "active" },
                { label: "Archived", value: "archived" },
              ],
            },
          ],
        };
      `,
    },
    {
      name: "object has extra keys — cannot collapse safely",
      code: `
        const config = {
          filters: [
            {
              key: "status",
              type: "select",
              options: [
                { label: "active", value: "active", icon: "x" },
              ],
            },
          ],
        };
      `,
    },
    {
      name: "options outside of filters: untouched",
      code: `
        const config = {
          someOther: {
            options: [
              { label: "active", value: "active" },
              { label: "archived", value: "archived" },
            ],
          },
        };
      `,
    },
    {
      name: "empty options array",
      code: `
        const config = {
          filters: [
            { key: "status", type: "select", options: [] },
          ],
        };
      `,
    },
  ],
  invalid: [
    {
      name: "label === value for every entry",
      code: `
        const config = {
          filters: [
            {
              key: "status",
              type: "select",
              options: [
                { label: "active", value: "active" },
                { label: "archived", value: "archived" },
              ],
            },
          ],
        };
      `,
      output: `
        const config = {
          filters: [
            {
              key: "status",
              type: "select",
              options: ["active", "archived"],
            },
          ],
        };
      `,
      errors: [{ messageId: "preferShorthand" }],
    },
    {
      name: "single-entry shorthand candidate",
      code: `
        const config = {
          filters: [
            { key: "kind", type: "select", options: [{ label: "x", value: "x" }] },
          ],
        };
      `,
      output: `
        const config = {
          filters: [
            { key: "kind", type: "select", options: ["x"] },
          ],
        };
      `,
      errors: [{ messageId: "preferShorthand" }],
    },
  ],
});
