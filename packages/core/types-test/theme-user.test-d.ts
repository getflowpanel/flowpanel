import type { ThemeConfig } from "@flowpanel/core";
import { expectAssignable, expectNotAssignable } from "tsd";

type UserMenu = NonNullable<ThemeConfig["user"]>;
declare const authUser: { name: string; email: string; image: string | null };
declare const optional: { name?: string | undefined };

expectAssignable<UserMenu>(() => ({
  name: authUser.name,
  email: authUser.email,
  avatar: authUser.image,
}));
expectAssignable<UserMenu>(() => ({ name: optional.name }));
expectAssignable<UserMenu>(() => undefined);
expectNotAssignable<UserMenu>(() => ({ avatar: 1 }));
