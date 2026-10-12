import { dashboard, metric } from "@flowpanel/kit";

export const overviewDashboard = dashboard({
  path: "/",
  label: "Overview",
  sections: [{ widgets: [metric("Orders", { count: "orders" })] }],
});
