import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish.js", () => ({
  publish: vi.fn(),
  publishResource: vi.fn(),
  bindPublisher: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { applyActionResult } from "../runtime/apply-action-result.js";
import { publish, publishResource } from "../runtime/publish.js";

describe("applyActionResult", () => {
  beforeEach(() => {
    vi.mocked(revalidatePath).mockReset();
    vi.mocked(publish).mockReset();
    vi.mocked(publishResource).mockReset();
  });

  it("does nothing when result.ok is false", async () => {
    await applyActionResult({ ok: false, error: "x" } as never, { resourceName: "users" });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it("publishes resource channel when refresh === true and resourceName given", async () => {
    await applyActionResult(
      { ok: true, refresh: true },
      { resourceName: "users", pathname: "/admin/users" },
    );
    expect(publishResource).toHaveBeenCalledWith("users", { action: "update" });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/users");
  });

  it("publishes each channel when refresh is string[]", async () => {
    await applyActionResult({ ok: true, refresh: ["scraperRuns", "alerts"] }, {});
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenNthCalledWith(1, "scraperRuns");
    expect(publish).toHaveBeenNthCalledWith(2, "alerts");
  });

  it("calls revalidatePath when pathname given and refresh is not explicitly false", async () => {
    await applyActionResult({ ok: true }, { pathname: "/admin/users" });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/users");
  });

  it("does NOT revalidate when refresh === false is explicit", async () => {
    await applyActionResult({ ok: true, refresh: false as never }, { pathname: "/admin/users" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
