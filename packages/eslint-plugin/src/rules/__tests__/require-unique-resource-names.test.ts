import rule from "../require-unique-resource-names.js";
import { ruleTester } from "./setup.js";

ruleTester().run("require-unique-resource-names", rule, {
  valid: [
    {
      name: "all unique names",
      code: `
        defineAdmin({
          resources: [
            resource(users, { name: "users" }),
            resource(posts, { name: "posts" }),
          ],
        });
      `,
    },
    {
      name: "no explicit names — rule abstains",
      code: `
        defineAdmin({
          resources: [
            resource(users),
            resource(posts),
          ],
        });
      `,
    },
    {
      name: "duplicates outside of defineAdmin are ignored",
      code: `
        someOther({
          resources: [
            resource(users, { name: "x" }),
            resource(posts, { name: "x" }),
          ],
        });
      `,
    },
    {
      name: "defineFlowPanel alias also accepted",
      code: `
        defineFlowPanel({
          resources: [
            resource(users, { name: "users" }),
            resource(posts, { name: "posts" }),
          ],
        });
      `,
    },
  ],
  invalid: [
    {
      name: "two resources share a name",
      code: `
        defineAdmin({
          resources: [
            resource(users, { name: "users" }),
            resource(otherUsers, { name: "users" }),
          ],
        });
      `,
      errors: [
        { messageId: "duplicate", data: { name: "users" } },
        { messageId: "duplicate", data: { name: "users" } },
      ],
    },
    {
      name: "three resources share a name",
      code: `
        defineAdmin({
          resources: [
            resource(a, { name: "x" }),
            resource(b, { name: "x" }),
            resource(c, { name: "x" }),
          ],
        });
      `,
      errors: [{ messageId: "duplicate" }, { messageId: "duplicate" }, { messageId: "duplicate" }],
    },
  ],
});
