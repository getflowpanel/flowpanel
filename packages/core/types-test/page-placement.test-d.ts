import { type AdminDefinition, dashboard, page } from "@flowpanel/core";
import { expectAssignable, expectError } from "tsd";

const Reports = () => null;
type Dashboards = NonNullable<AdminDefinition["dashboards"]>;

expectAssignable<Dashboards>([dashboard({ path: "/", label: "Overview", sections: [] })]);
expectAssignable<NonNullable<AdminDefinition["pages"]>>([
  page({ path: "/reports", label: "Reports", component: Reports }),
]);
expectError<Dashboards>([page({ path: "/reports", label: "Reports", component: Reports })]);
