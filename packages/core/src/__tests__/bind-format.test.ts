import { describe, expect, it } from "vitest";
import { bindFormat } from "../bind-format";
import { resolveFormatting } from "../types/formatting";

const ru = bindFormat(
  resolveFormatting({ locale: "ru-RU", timeZone: "Europe/Moscow", currency: "RUB" }),
);
const en = bindFormat(resolveFormatting());
const newYork = bindFormat(resolveFormatting({ timeZone: "America/New_York" }));
const orders = { one: "{n} заказ", few: "{n} заказа", many: "{n} заказов", other: "{n} заказа" };

describe("bindFormat", () => {
  it("prints days and timestamps in the admin's zone and locale", () => {
    expect(ru.date(new Date("2026-09-23T21:30:00Z"))).toBe("24.09.2026");
    expect(ru.dateTime("2026-09-23T21:30:00Z")).toBe("24.09.2026 00:30");
    expect(en.dateTime(new Date("2026-09-23T21:30:00Z"))).toBe("2026-09-23 21:30");
  });

  it("keeps a YYYY-MM-DD value on its own day", () => {
    expect(newYork.date("2026-09-23")).toBe("2026-09-23");
    expect(newYork.dateTime("2026-09-23")).toBe("2026-09-23");
  });

  it("says how long ago against the given clock", () => {
    const now = new Date("2026-09-23T12:00:00Z");
    expect(ru.relative(new Date("2026-09-23T11:55:00Z"), now)).toBe("5 минут назад");
  });

  it("prints numbers, money, percents and durations the admin's way", () => {
    expect(ru.number(1774.5, 0)).toMatch(/^1\s775$/);
    expect(ru.money(1500)).toMatch(/^1\s500\s₽$/);
    expect(ru.money(150_000, { minorUnits: 2 })).toMatch(/^1\s500\s₽$/);
    expect(en.money(12.5, { currency: "EUR", digits: 2 })).toBe("€12.50");
    expect(ru.percent(0.423)).toMatch(/^42,3\s%$/);
    expect(ru.duration(7_500_000)).toBe("2 ч 5 мин");
  });

  it("picks the plural form and formats the count", () => {
    expect(ru.plural(3, orders)).toBe("3 заказа");
    expect(ru.plural(1333, orders)).toMatch(/^1\s333 заказа$/);
    expect(en.plural(2, "{n} runs")).toBe("2 runs");
  });

  it("prints a dash for a missing value", () => {
    expect(ru.date(null)).toBe("—");
    expect(ru.relative(undefined)).toBe("—");
    expect(ru.number(undefined)).toBe("—");
    expect(ru.money(null)).toBe("—");
    expect(ru.duration(null)).toBe("—");
  });

  it("prints a dash for a missing or NaN number", () => {
    expect(en.money(Number.NaN)).toBe("—");
    expect(en.number(null)).toBe("—");
  });
});
