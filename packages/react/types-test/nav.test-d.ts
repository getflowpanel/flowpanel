import type { NavGroup } from "@flowpanel/react";
import { expectAssignable, expectNotAssignable } from "tsd";

expectAssignable<NavGroup>({ label: "Journals", collapsible: true, items: [] });
expectNotAssignable<NavGroup>({ label: "Journals", collapsible: "yes", items: [] });
