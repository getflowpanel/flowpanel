import type { RowOf } from "@flowpanel/kit";
import { headerContext, resolveWidget, widgetContext } from "@flowpanel/kit/test/widgets";
import { describe, expect, it } from "vitest";
import admin from "../config";
import { customerCard, openInvoices } from "../config/resources/customer-card";
import { customers } from "../config/resources/customers";

const row: RowOf<"customers"> = {
  id: 7,
  email: "ops@northwind.test",
  name: "Jane Doe",
  company: "Northwind Audio",
  plan: "pro",
  status: "past_due",
  createdAt: new Date("2026-01-05T00:00:00.000Z"),
  lastSeenAt: null,
  deletedAt: null,
  sandboxId: "local",
  seedKey: null,
};

const header = headerContext();

describe("the customer record page", () => {
  it("heads the page with the company, falling back to the email", () => {
    expect(customerCard.title(row)).toBe("Northwind Audio");
    expect(customerCard.title({ ...row, company: null })).toBe("ops@northwind.test");
  });

  it("says how long they have been a customer", () => {
    expect(customerCard.subtitle(row, header)).toMatch(/^Customer since /);
  });

  it("shows status and plan as toned pills, the status linking to its filtered list", () => {
    expect(customerCard.badge(row)).toEqual([
      {
        label: "Past due",
        tone: "err",
        href: { resource: "customers", filter: { status: "past_due" } },
      },
      { label: "Pro", tone: "accent" },
    ]);
  });

  it("lists monitors, products and invoices as related tabs", () => {
    expect(customerCard.tabs.map((tab) => tab.resource)).toEqual([
      "monitors",
      "products",
      "invoices",
    ]);
  });

  it("is the customers resource's record page", () => {
    expect(customers.options.detail).toMatchObject({ tabs: customerCard.tabs });
  });

  it("counts only this customer's open invoices and links to them", async () => {
    const ctx = widgetContext({
      admin,
      resource: "customers",
      row: { id: 7 },
      rows: {
        invoices: [
          { customerId: 7, status: "open" },
          { customerId: 7, status: "paid" },
          { customerId: 9, status: "open" },
        ],
      },
    });
    const { props } = await resolveWidget(openInvoices, ctx);
    expect(props).toMatchObject({ value: 1, tone: "warn" });
    expect(props.drilldown).toContain("f_customerId=7");
    expect(props.drilldown).toContain("f_status=open");
  });
});
