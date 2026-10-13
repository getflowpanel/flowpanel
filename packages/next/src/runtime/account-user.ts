import type { ResolvedAdminConfig, Session } from "@flowpanel/core";
import type { AccountMenuUser } from "@flowpanel/react";

/** `theme.user` for this session, its empty `name`, `email` and `avatar` left out. */
export function accountUser(
  config: ResolvedAdminConfig,
  session: Session | null,
): AccountMenuUser | undefined {
  const user = config.theme?.user?.(session);
  if (!user) return undefined;
  const { name, email, avatar, ...rest } = user;
  return {
    ...rest,
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(avatar ? { avatar } : {}),
  };
}
