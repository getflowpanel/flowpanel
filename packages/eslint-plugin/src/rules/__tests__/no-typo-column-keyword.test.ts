import rule from "../no-typo-column-keyword.js";
import { ruleTester } from "./setup.js";

ruleTester().run("no-typo-column-keyword", rule, {
  valid: [
    {
      name: "all column keys are correct camelCase",
      code: `
        const config = {
          columns: ["userId", "createdAt", "isActive"],
        };
      `,
    },
    {
      name: "object form with correct camelCase key",
      code: `
        const config = {
          columns: [
            { key: "userId", label: "User" },
          ],
        };
      `,
    },
    {
      name: "unrelated string that is not a tracked typo",
      code: `
        const config = {
          columns: ["totallyCustomField"],
        };
      `,
    },
    {
      name: "non-columns property with same shape",
      code: `
        const config = {
          other: ["userid"],
        };
      `,
    },
  ],
  invalid: [
    {
      name: "bare-string typo: userid",
      code: `
        const config = {
          columns: ["userid"],
        };
      `,
      // `output: null` = reported but never rewritten. `eslint --fix` used to
      // silently turn a legitimately lowercase `userid` column into `userId`.
      output: null,
      errors: [
        {
          messageId: "typo",
          data: { actual: "userid", suggested: "userId" },
        },
      ],
    },
    {
      name: "bare-string typo: createdat",
      code: `
        const config = {
          columns: ["createdat"],
        };
      `,
      output: null,
      errors: [{ messageId: "typo" }],
    },
    {
      name: "object form with key typo",
      code: `
        const config = {
          columns: [
            { key: "isactive", label: "Active" },
          ],
        };
      `,
      output: null,
      errors: [{ messageId: "typo" }],
    },
  ],
});
