import { dashboard, type NavGroupRef, resource } from "@flowpanel/core";
import { expectAssignable, expectNotAssignable } from "tsd";

expectAssignable<NavGroupRef>("Journals");
expectAssignable<NavGroupRef>({ label: "Journals", collapsed: true });
expectNotAssignable<NavGroupRef>({ collapsed: true });
dashboard({ path: "/parsing", label: "Parsing", sections: [], navGroup: "Analytics" });
resource({ __name: "scraper_run" }, { navGroup: { label: "Journals", collapsed: true } });
