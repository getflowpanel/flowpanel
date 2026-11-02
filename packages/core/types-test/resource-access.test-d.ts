import { resource } from "@flowpanel/core";
import { expectError } from "tsd";

type Row = { id: number; body: string };
declare const notes: { $inferSelect: Row };

resource(notes, { access: "admin" });
resource(notes, { access: ["admin", "support"] });
resource(notes, { access: false });
resource(notes, { access: ({ role }) => role === "admin" });
resource(notes, { access: { read: true, create: "admin", update: ["admin"], delete: false } });
expectError(resource(notes, { access: 42 }));
expectError(resource(notes, { access: { reed: "admin" } }));
expectError(resource(notes, { access: ({ role }) => role.missing() }));
