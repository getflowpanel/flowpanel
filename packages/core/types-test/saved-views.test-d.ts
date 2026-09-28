import { resource } from "@flowpanel/core";
import { expectError } from "tsd";

declare const users: {
  $inferSelect: { id: number; plan: string; createdAt: Date; daysSinceSeen: number };
};

resource(users, {
  views: [
    { name: "New this week", filters: { createdAt: "last7d" } },
    { name: "Paying, asleep", filters: { plan: ["starter", "pro"], daysSinceSeen: { gte: 7 } } },
    { name: "Either plan", filters: { plan: { op: "in", values: ["starter", "pro"] } } },
  ],
});
expectError(resource(users, { views: [{ name: "Typo", filters: { creatdAt: "last7d" } }] }));
resource(users, { views: [{ name: "Ids", filters: { id: [1, 2] } }] });
