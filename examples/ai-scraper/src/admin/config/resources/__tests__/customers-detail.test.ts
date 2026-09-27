import { resolveWidget, widgetContext } from "@flowpanel/test/widgets";
import { describe, expect, it } from "vitest";
import { openInvoicesWidget } from "../customers-detail";

describe("openInvoicesWidget", () => {
  it("counts only this customer's open invoices and links to them", async () => {
    const ctx = widgetContext({
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
    const { props } = await resolveWidget(openInvoicesWidget, ctx);
    expect(props.value).toBe(1);
    expect(props.tone).toBe("warn");
    expect(props.href).toContain("/admin/invoices");
    expect(props.href).toContain("f_customerId=7");
    expect(props.href).toContain("f_status=open");
  });

  it("shows no warning tone with nothing open", async () => {
    const ctx = widgetContext({
      resource: "customers",
      row: { id: 7 },
      rows: { invoices: [{ customerId: 7, status: "paid" }] },
    });
    const { props } = await resolveWidget(openInvoicesWidget, ctx);
    expect(props.value).toBe(0);
    expect(props.tone).toBeUndefined();
  });
});
