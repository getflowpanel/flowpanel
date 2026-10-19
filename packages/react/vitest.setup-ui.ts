import { beforeAll } from "vitest";
import { preloadPhoneCards } from "./src/data/phone-cards";
import { preloadMenus } from "./src/ui/dropdown-menu";
import { preloadPopovers } from "./src/ui/popover";
import { preloadSelects } from "./src/ui/select";

/** Menus, popovers, selects and phone cards fetch their code on first use; a test gets it before it starts. */
beforeAll(async () => {
  await Promise.all([preloadMenus(), preloadPopovers(), preloadSelects(), preloadPhoneCards()]);
});
