import { describe, expect, it } from "vitest";
import { consoleText, formatConsoleArgs } from "../console-text";

const BADGE =
  "background: #e6e6e6;background: light-dark(rgba(0,0,0,0.1), rgba(255,255,255,0.25));color: #000000;border-radius: 2px";

describe("a console message as smokeAdmin reports it", () => {
  it("drops React's %c badge styling and fills in %s", () => {
    expect(
      formatConsoleArgs([
        "%c%s%c Each child in a list should have a unique %s prop.",
        BADGE,
        " Server ",
        "",
        "key",
      ]),
    ).toBe("Server Each child in a list should have a unique key prop.");
  });

  it("keeps arguments the format does not use, and a plain message as it is", () => {
    expect(formatConsoleArgs(["failed", { status: 500 }])).toBe('failed {"status":500}');
    expect(formatConsoleArgs(["100%% done"])).toBe("100% done");
  });

  it("falls back to the text, without %c, when the page is gone", async () => {
    const message = {
      type: () => "error",
      text: () => `%c%s%c boom ${BADGE}`,
      args: () => [{ jsonValue: () => Promise.reject(new Error("context destroyed")) }],
    };
    expect(await consoleText(message)).not.toContain("%c");
  });
});
