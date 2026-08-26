import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish", () => ({
  publish: vi.fn(),
  publishResource: vi.fn(),
  bindPublisher: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { applyActionResult } from "../runtime/apply-action-result";
import { publish, publishResource } from "../runtime/publish";

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

  it("publishes to exactly that channel when refresh is a bare string", async () => {
    await applyActionResult({ ok: true, refresh: "scraperRuns" }, {});
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith("scraperRuns");
  });

  it("calls revalidatePath when pathname given and refresh is not explicitly false", async () => {
    await applyActionResult({ ok: true }, { pathname: "/admin/users" });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/users");
  });

  it("does NOT revalidate when refresh === false is explicit", async () => {
    await applyActionResult({ ok: true, refresh: false as never }, { pathname: "/admin/users" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("isolates realtime and revalidation failures and returns typed warnings", async () => {
    vi.mocked(publishResource).mockRejectedValueOnce(new Error("redis unavailable"));
    vi.mocked(revalidatePath).mockImplementationOnce(() => {
      throw new Error("cache unavailable");
    });

    await expect(
      applyActionResult(
        { ok: true, refresh: true },
        { resourceName: "users", pathname: "/admin/users" },
      ),
    ).resolves.toEqual([
      { code: "realtime_failed", message: "Realtime refresh could not be published." },
      { code: "revalidation_failed", message: "Cached views could not be refreshed." },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/users");
  });
});
