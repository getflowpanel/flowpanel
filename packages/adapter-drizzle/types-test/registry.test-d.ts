import type {
  ActionContext,
  InferRow,
  ReferenceSpec,
  ResourceName,
  RowOf,
  WidgetContext,
} from "@flowpanel/core";
import { type BetterAuthOptions, withBetterAuth } from "@flowpanel/core/auth";
import { integer, pgTable, pgView, text, timestamp } from "drizzle-orm/pg-core";
import { expectAssignable, expectError, expectType } from "tsd";

const user = pgTable("user", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
});
const userVisit = pgTable("user_visit", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  startedAt: timestamp("started_at").notNull(),
});
const adminUserRow = pgView("admin_user_row", {
  id: text("id").notNull(),
  email: text("email").notNull(),
  lifecycle: text("lifecycle").notNull(),
  sent30d: integer("sent_30d").notNull(),
}).existing();
const schema = { user, userVisit, adminUserRow };

declare const db: { execute(query: string): Promise<unknown> };
type AuthSession = { session: { id: string }; user: { id: string; email: string; role: string } };
type UserRow = { id: string; email: string; lifecycle: string; sent30d: number };
type VisitRow = { id: string; userId: string; startedAt: Date };

declare module "@flowpanel/core" {
  interface FlowpanelTypes {
    db: typeof db;
    schema: typeof schema;
    session: AuthSession;
  }
  interface FlowpanelResources {
    user: typeof adminUserRow.$inferSelect;
  }
}

expectType<"user" | "user_visit" | "admin_user_row">({} as ResourceName);
expectType<VisitRow>({} as RowOf<"user_visit">);
expectType<UserRow>({} as RowOf<"user">);
expectType<Record<string, unknown>>({} as RowOf<"not_registered">);
expectType<VisitRow>({} as InferRow<typeof userVisit>);
expectType<UserRow>({} as InferRow<"user">);

expectAssignable<ReferenceSpec>({ resource: "user_visit", labelField: "userId" });
expectError<ReferenceSpec>({ resource: "user_visit", labelField: "lifecycle" });

declare const ctx: WidgetContext;
expectType<AuthSession | null>(ctx.session);
expectType<typeof db>(ctx.db);
expectType<UserRow>(ctx.rowOf("user"));
expectType<Promise<number>>(ctx.count("user_visit", { userId: "u1" }, { range: "startedAt" }));
expectType<Promise<VisitRow[]>>(ctx.read("user_visit", { where: { userId: "u1" } }));
expectError(ctx.count("user_vist"));
expectError(ctx.count("user", { name: "Ann" }));

declare const action: ActionContext;
expectType<typeof db>(action.db);

expectType<AuthSession | null>({} as Parameters<NonNullable<BetterAuthOptions["role"]>>[0]);
withBetterAuth({
  auth: { api: { getSession: async () => null } },
  role: (session) => session?.user.role ?? "guest",
});
expectError(
  withBetterAuth({
    auth: { api: { getSession: async () => null } },
    role: (session) => session?.user.nope ?? "guest",
  }),
);
