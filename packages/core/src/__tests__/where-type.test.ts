import { describe, expectTypeOf, it } from "vitest";
import type { ListFilters, Where } from "../types/where";

interface User {
  id: string;
  deletedAt: Date | null;
  plan: string;
}

describe("Where and ListFilters", () => {
  it("keeps null out of a read or count where, which the server rejects", () => {
    expectTypeOf<{ deletedAt: null }>().not.toMatchTypeOf<Where<User>>();
    expectTypeOf<{ deletedAt: "__null__" }>().toMatchTypeOf<Where<User>>();
  });

  it("lets a link or view filter pass null to turn a default off", () => {
    expectTypeOf<{ plan: null }>().toMatchTypeOf<ListFilters<User>>();
  });
});
