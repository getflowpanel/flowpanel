"use client";

// Leaks server-only config into the client bundle via a helper.
import { flowpanel } from "../src/helper";

export function Dashboard() {
  return flowpanel.appName;
}
