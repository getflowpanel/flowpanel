// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChunkBoundary } from "../chunk-boundary";
import { lazyRetry } from "../lazy-retry";

afterEach(cleanup);

describe("a part that loads on demand", () => {
  it("shows a message with Retry when its code cannot load, and loads again on Retry", async () => {
    let online = false;
    const Part = lazyRetry<{ text: string }>(() => {
      return !online
        ? Promise.reject(new Error("chunk gone"))
        : Promise.resolve({ default: ({ text }: { text: string }) => <p>{text}</p> });
    });
    render(
      <ChunkBoundary>
        <React.Suspense fallback={null}>
          <Part text="loaded" />
        </React.Suspense>
      </ChunkBoundary>,
    );
    const alert = await screen.findByRole("alert", {}, { timeout: 3000 });
    expect(alert.textContent).toContain("Retry");
    online = true;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("loaded")).toBeTruthy();
  });

  it("passes an error the part throws while rendering to the boundary above, with its own message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const Part = lazyRetry(() =>
      Promise.resolve({
        default: () => {
          throw new Error("fields must be an array");
        },
      }),
    );
    class Outer extends React.Component<{ children: React.ReactNode }, { message: string }> {
      override state = { message: "" };
      static getDerivedStateFromError(error: Error) {
        return { message: error.message };
      }
      override render() {
        return this.state.message ? <p>{this.state.message}</p> : this.props.children;
      }
    }
    render(
      <Outer>
        <ChunkBoundary>
          <React.Suspense fallback={null}>
            <Part />
          </React.Suspense>
        </ChunkBoundary>
      </Outer>,
    );
    expect(await screen.findByText("fields must be an array")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    vi.restoreAllMocks();
  });
});
