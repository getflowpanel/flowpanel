import { afterEach, describe, expect, it, vi } from "vitest";
import { triggerDownload } from "../trigger-download.js";

const createObjectURL = vi.fn((_obj: Blob | MediaSource): string => "blob:fake");
const revokeObjectURL = vi.fn((_url: string): void => undefined);

describe("triggerDownload", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    createObjectURL.mockReset();
    revokeObjectURL.mockReset();
  });

  it("creates a Blob with the provided mime, invokes a temporary anchor click, and revokes", () => {
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURL;

    const click = vi.fn();
    const anchor = { href: "", download: "", click, remove: vi.fn() };
    const createSpy = vi.spyOn(document, "createElement").mockReturnValue(anchor as never);
    const appendSpy = vi.spyOn(document.body, "appendChild").mockImplementation((x) => x);

    triggerDownload({ filename: "x.csv", data: "a,b\n1,2", mime: "text/csv" });

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blobArg = createObjectURL.mock.calls[0]?.[0];
    expect(blobArg).toBeInstanceOf(Blob);
    expect((blobArg as unknown as Blob).type).toBe("text/csv");
    expect(createSpy).toHaveBeenCalledWith("a");
    expect(anchor.href).toBe("blob:fake");
    expect(anchor.download).toBe("x.csv");
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake");

    appendSpy.mockRestore();
    createSpy.mockRestore();
  });

  it("defaults mime to application/octet-stream when omitted", () => {
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURL;
    const anchor = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
    vi.spyOn(document, "createElement").mockReturnValue(anchor as never);
    vi.spyOn(document.body, "appendChild").mockImplementation((x) => x);

    triggerDownload({ filename: "x.bin", data: new Uint8Array([1, 2, 3]) });

    const blobArg = createObjectURL.mock.calls[0]?.[0] as unknown as Blob;
    expect(blobArg.type).toBe("application/octet-stream");
  });

  it("passes a Blob through unchanged if given a Blob", () => {
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURL;
    const anchor = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
    vi.spyOn(document, "createElement").mockReturnValue(anchor as never);
    vi.spyOn(document.body, "appendChild").mockImplementation((x) => x);

    const srcBlob = new Blob(["hi"], { type: "text/plain" });
    triggerDownload({ filename: "hi.txt", data: srcBlob });

    expect(createObjectURL).toHaveBeenCalledWith(srcBlob);
  });
});
