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
    {
      name: "distinct string refs (Prisma form)",
      code: `
        defineAdmin({
          resources: [
            resource("User", { label: "Users" }),
            resource("Post", { label: "Posts" }),
          ],
        });
      `,
    },
    {
      name: "distinct imported resources (decomposed layout)",
      code: `
        import { users } from "./resources/users";
        import { scrapers } from "./resources/scrapers";
        defineAdmin({ resources: [users, scrapers] });
      `,
    },
    {
      name: "a string ref and an imported identifier are not compared",
      code: `
        import { users } from "./resources/users";
        defineAdmin({ resources: [users, resource("users", { label: "Users" })] });
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
    {
      name: "two string refs share a name (Prisma form, no `name` option)",
      code: `
        defineAdmin({
          resources: [
            resource("User", { label: "Users" }),
            resource("User", { label: "People" }),
          ],
        });
      `,
      errors: [
        { messageId: "duplicate", data: { name: "User" } },
        { messageId: "duplicate", data: { name: "User" } },
      ],
    },
    {
      name: "`name` option still wins over the string ref",
      code: `
        defineAdmin({
          resources: [
            resource("User", { name: "people" }),
            resource("Account", { name: "people" }),
          ],
        });
      `,
      errors: [
        { messageId: "duplicate", data: { name: "people" } },
        { messageId: "duplicate", data: { name: "people" } },
      ],
    },
    {
      name: "the same imported resource is listed twice (decomposed layout)",
      code: `
        import { users } from "./resources/users";
        import { scrapers } from "./resources/scrapers";
        defineAdmin({ resources: [users, scrapers, users] });
      `,
      errors: [
        { messageId: "duplicateRef", data: { name: "users" } },
        { messageId: "duplicateRef", data: { name: "users" } },
      ],
    },
    {
      name: "local consts resolve to their resource() names",
      code: `
        const a = resource(users, { name: "users" });
        const b = resource(otherUsers, { name: "users" });
        defineAdmin({ resources: [a, b] });
      `,
      errors: [
        { messageId: "duplicate", data: { name: "users" } },
        { messageId: "duplicate", data: { name: "users" } },
      ],
    },
  ],
});
