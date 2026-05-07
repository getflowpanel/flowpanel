// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TimeAgo } from "../TimeAgo.js";

afterEach(cleanup);

describe("TimeAgo", () => {
  it("renders a relative label for a past date", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    render(<TimeAgo date={twoHoursAgo} />);
    const t = screen.getByText(/hour/i);
    expect(t).toBeTruthy();
    expect((t as HTMLTimeElement).dateTime).toBe(twoHoursAgo.toISOString());
  });

  it("accepts ISO string input", () => {
    const past = new Date(Date.now() - 5 * 60_000).toISOString();
    render(<TimeAgo date={past} />);
    expect(screen.getByText(/minute|min/i)).toBeTruthy();
  });
});
