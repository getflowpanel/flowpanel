import { beforeAll } from "vitest";

/** Menus, popovers, selects and phone cards fetch their code on first use; a DOM test gets it before it starts. */
beforeAll(async () => {
  if (typeof document === "undefined") return;
  const [cards, menus, popovers, selects] = await Promise.all([
    import("../react/dist/data/phone-cards.mjs"),
    import("../react/dist/ui/dropdown-menu.mjs"),
    import("../react/dist/ui/popover.mjs"),
    import("../react/dist/ui/select.mjs"),
  ]);
  await Promise.all([
    cards.preloadPhoneCards(),
    menus.preloadMenus(),
    popovers.preloadPopovers(),
    selects.preloadSelects(),
  ]);
});
