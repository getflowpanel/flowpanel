import { describe, expect, it } from "vitest";
import { hostHeaderTag } from "../init-plan";

describe("the header a root layout renders", () => {
  it("is a literal header or a header component", () => {
    expect(hostHeaderTag('<body><header className="h-14">Acme</header>')).toBe("header");
    expect(hostHeaderTag("<body><SiteHeader />{children}")).toBe("SiteHeader");
    expect(hostHeaderTag("<body><Header user={user}>")).toBe("Header");
    expect(hostHeaderTag("<body><layout.Navbar/>")).toBe("layout.Navbar");
  });

  it("is nothing for a plain layout or a component that only mentions a header", () => {
    expect(hostHeaderTag("<body>{children}</body>")).toBeNull();
    expect(hostHeaderTag("<body><HeaderContext.Provider>")).toBeNull();
    expect(hostHeaderTag("<body><thead>")).toBeNull();
  });
});
