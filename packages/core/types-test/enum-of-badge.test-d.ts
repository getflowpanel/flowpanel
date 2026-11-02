import { enumOf, type LinkTarget } from "@flowpanel/core";
import { expectError, expectType } from "tsd";

const Plan = enumOf({ free: ["Free", "muted"], pro: ["Pro", "accent"] });
const pill = Plan.badge("pro", { href: { resource: "users", filter: { email: "a@b.co" } } });
if (pill) expectType<LinkTarget | undefined>(pill.href);
expectError(Plan.badge("pro", { href: 42 }));
