import { describe, expect, it } from "vitest";
import {
  currencyDigits,
  type MoneyStorage,
  majorUnitsInput,
  moneyDecimals,
  moneyStorage,
  parseMajorUnits,
  parseMoney,
} from "../money-input";

const minor = (minorUnits = 2) => ({ minorUnits, storage: "minor" as const });
const major = (minorUnits = 2) => ({ minorUnits, storage: "major" as const });

/** What an untouched form posts back, read the way the server reads it. */
function roundTrip(value: unknown, shape: { minorUnits: number; storage: MoneyStorage }) {
  return parseMoney(majorUnitsInput(value, shape), shape);
}

describe("majorUnitsInput", () => {
  it("shows whole minor units as major units", () => {
    expect(majorUnitsInput(39999, minor())).toBe("399.99");
    expect(majorUnitsInput("39999", minor())).toBe("399.99");
    expect(majorUnitsInput(5, minor())).toBe("0.05");
    expect(majorUnitsInput(-1250, minor())).toBe("-12.50");
    expect(majorUnitsInput(123456789n, minor(3))).toBe("123456.789");
    expect(majorUnitsInput(500, minor(0))).toBe("500");
  });

  it("reads a decimal column of minor units by its value, not its text", () => {
    expect(majorUnitsInput("39999.00", minor())).toBe("399.99");
  });

  it("shows a major-unit decimal or float at the currency's precision", () => {
    expect(majorUnitsInput("39999.00", major())).toBe("39999.00");
    expect(majorUnitsInput(19.99, major())).toBe("19.99");
    expect(majorUnitsInput(0.1 + 0.2, major())).toBe("0.30");
    expect(majorUnitsInput(-12.5, major())).toBe("-12.50");
    expect(majorUnitsInput("1.2340", major(3))).toBe("1.234");
    expect(majorUnitsInput(7, major(0))).toBe("7");
  });

  it("shows a value the currency cannot hold as it is, never rounded", () => {
    expect(majorUnitsInput(1999.5, minor())).toBe("19.995");
    expect(majorUnitsInput("39999.50", minor())).toBe("399.995");
    expect(majorUnitsInput("1.2345", major(3))).toBe("1.2345");
    expect(majorUnitsInput(19.995, major())).toBe("19.995");
    expect(majorUnitsInput(-0.4, minor())).toBe("-0.004");
    expect(roundTrip(1999.5, minor())).toBeNull();
    expect(roundTrip(19.995, major())).toBeNull();
  });

  it("writes the admin's decimal separator and leaves empty values empty", () => {
    expect(majorUnitsInput(48799, { ...minor(), decimalSeparator: "," })).toBe("487,99");
    expect(majorUnitsInput(null, minor())).toBe("");
    expect(majorUnitsInput("", minor())).toBe("");
  });
});

describe("parseMoney", () => {
  it("reads typed text into whole minor units without float drift", () => {
    expect(parseMoney("399.99", minor())).toBe(39999);
    expect(parseMoney("0.29", minor())).toBe(29);
    expect(parseMoney("1 299,5", minor())).toBe(129950);
    expect(parseMoney("487,99", minor())).toBe(48799);
    expect(parseMoney("−12,50", minor())).toBe(-1250);
    expect(parseMoney("7", minor(0))).toBe(7);
    expect(parseMoney("1.234", minor(3))).toBe(1234);
    expect(parseMoney("12.500", minor())).toBe(1250);
  });

  it("reads typed text into an exact major-unit decimal for a decimal column", () => {
    expect(parseMoney("399.99", major())).toBe("399.99");
    expect(parseMoney("-0.5", major())).toBe("-0.50");
    expect(parseMoney("12", major(3))).toBe("12.000");
  });

  it("refuses text that is not an amount or has more decimals than the currency keeps", () => {
    expect(parseMoney("12.345", minor())).toBeNull();
    expect(parseMoney("1.5", minor(0))).toBeNull();
    expect(parseMoney("abc", minor())).toBeNull();
    expect(parseMoney("1,000.00", minor())).toBeNull();
    expect(parseMajorUnits("99999999999999999999", 2)).toBeNull();
  });

  it("gives back what an untouched form showed, for every storage", () => {
    expect(roundTrip(39999, minor())).toBe(39999);
    expect(roundTrip("39999.00", minor())).toBe(39999);
    expect(roundTrip(-1250, minor())).toBe(-1250);
    expect(roundTrip(500, minor(0))).toBe(500);
    expect(roundTrip(1234, minor(3))).toBe(1234);
    expect(roundTrip("39999.00", major())).toBe("39999.00");
    expect(roundTrip(19.99, major())).toBe("19.99");
  });
});

describe("moneyDecimals", () => {
  it("counts the decimals typed past trailing zeros", () => {
    expect(moneyDecimals("19.995")).toBe(3);
    expect(moneyDecimals("12,50")).toBe(1);
    expect(moneyDecimals("12")).toBe(0);
    expect(moneyDecimals("abc")).toBeNull();
  });
});

describe("currency digits and storage", () => {
  it("defaults the digits to the currency's own", () => {
    expect(currencyDigits("USD")).toBe(2);
    expect(currencyDigits("JPY")).toBe(0);
    expect(currencyDigits("KWD")).toBe(3);
    expect(currencyDigits(undefined)).toBe(2);
  });

  it("stores minor units unless the column is a decimal or float", () => {
    expect(moneyStorage(undefined, { type: "number", integer: true })).toBe("minor");
    expect(moneyStorage(undefined, { type: "number", integer: false })).toBe("major");
    expect(moneyStorage(undefined, { type: "number" })).toBe("minor");
    expect(moneyStorage("minor", { type: "number", integer: false })).toBe("minor");
  });
});
