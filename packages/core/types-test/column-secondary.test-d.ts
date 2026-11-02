import { resource } from "@flowpanel/core";
import { expectError } from "tsd";

type User = { id: number; name: string; email: string };
declare const users: { $inferSelect: User };

resource(users, { columns: [{ field: "name", label: "Name", secondary: "email" }] });
expectError(resource(users, { columns: [{ field: "name", secondary: "emial" }] }));
