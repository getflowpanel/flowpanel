import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";

// `@typescript-eslint/rule-tester` was originally written for Mocha. Wire it to
// vitest's globals so the test cases register inside vitest's test runner.
RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

export function ruleTester(): RuleTester {
  return new RuleTester({
    languageOptions: {
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
  });
}
