import { dashboard, metric, type RealtimeOption, table } from "@flowpanel/core";
import { expectAssignable, expectError, expectNotAssignable } from "tsd";

expectAssignable<RealtimeOption>("pipeline");
expectAssignable<RealtimeOption>({ resource: "users" });
expectAssignable<RealtimeOption>(["pipeline", { resource: "users" }]);
expectAssignable<RealtimeOption>(["a", "b"]);
expectNotAssignable<RealtimeOption>({ channel: "pipeline" });
metric("Signups", async () => 1, { realtime: { resource: "users" } });
table({ resource: "visits", realtime: [{ resource: "visits" }, "pipeline"] });
dashboard({ path: "/", label: "Pulse", realtime: { resource: "visits" }, sections: [] });
expectError(metric("Signups", async () => 1, { realtime: { table: "visits" } }));
