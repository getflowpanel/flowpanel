import { type MetricWidget, metric } from "@flowpanel/core";
import { expectError, expectType } from "tsd";

expectType<MetricWidget>(metric("Users", { count: "users" }));
expectType<MetricWidget>(
  metric(
    "Signed up",
    { count: "users", where: (c) => ({ email: c.id }), range: "id" },
    { compare: true },
  ),
);
expectError(metric("Users", { count: "user" }));
expectError(metric("Users", { count: "users", where: { emial: "a@b.co" } }));
expectError(metric("Users", { count: "users", range: "createdAt" }));
