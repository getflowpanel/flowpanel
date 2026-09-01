import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GitHubStars } from "./GitHubStars";

describe("GitHub header link", () => {
  it("renders the repository as an accessible external link", () => {
    const html = renderToStaticMarkup(<GitHubStars />);

    expect(html).toContain('aria-label="flowpanel on GitHub"');
    expect(html).toContain('href="https://github.com/getflowpanel/flowpanel"');
    expect(html).toContain('rel="noreferrer"');
  });
});
