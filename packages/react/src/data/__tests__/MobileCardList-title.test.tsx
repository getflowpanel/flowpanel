// @vitest-environment happy-dom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { withEmailBreaks } from "../../lib/email-breaks";
import { MobileCardList } from "../MobileCardList";

afterEach(cleanup);

describe("a phone card", () => {
  it("takes its first text column as the title, not an id", () => {
    const { container } = render(
      <MobileCardList
        columns={[
          { field: "id", type: "number" },
          { field: "email", content: "email" },
          { field: "plan" },
        ]}
        rows={[{ id: 7, email: "ada@acme.test", plan: "pro" }]}
        rowKey="id"
      />,
    );
    const title = container.querySelector("li .fp-font-medium");
    expect(title?.textContent).toBe("ada@acme.test");
    expect(container.textContent).toContain("7");
  });

  it("lets an email wrap after the @ and before a dot, not inside a word", () => {
    const { container } = render(<p>{withEmailBreaks("marcus@northwindaudio.com")}</p>);
    expect(container.innerHTML).toBe("<p>marcus@<wbr>northwindaudio<wbr>.com</p>");
    expect(withEmailBreaks("not an email")).toBe("not an email");
  });
});
