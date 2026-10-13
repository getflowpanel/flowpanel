// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AsyncSelect } from "../../forms/AsyncSelect";
import { TagFilter } from "../filters/TagFilter";
import { TextFilter } from "../filters/TextFilter";
import { JsonEditor } from "../JsonEditor";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** What the DOM shows when the new props commit, before any effect could catch it up. */
function CommitProbe({ read, onCommit }: { read: () => string; onCommit: (text: string) => void }) {
  React.useLayoutEffect(() => {
    onCommit(read());
  });
  return null;
}

describe("controls that copy a prop into state", () => {
  it("TextFilter calls the handler it has now, not the one it had when typing started", () => {
    vi.useFakeTimers();
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<TextFilter label="Name" value={null} onChange={first} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "ann" } });
    rerender(<TextFilter label="Name" value={null} onChange={second} />);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("ann");
  });

  it("TextFilter shows a new value from outside in the same render and does not echo it back", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { rerender } = render(<TextFilter label="Name" value="a" onChange={onChange} />);
    rerender(<TextFilter label="Name" value="b" onChange={onChange} />);
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("b");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("TagFilter and TextFilter commit a new value with the new text, not a frame late", () => {
    const committed: string[] = [];
    function Harness({ value }: { value: string }) {
      return (
        <>
          <TagFilter label="Tags" value={value} onChange={() => undefined} />
          <TextFilter label="Name" value={value} onChange={() => undefined} />
          <CommitProbe
            read={() =>
              [screen.getByLabelText("Tags"), screen.getByLabelText("Name")]
                .map((input) => (input as HTMLInputElement).value)
                .join("|")
            }
            onCommit={(text) => committed.push(text)}
          />
        </>
      );
    }
    const { rerender } = render(<Harness value="a" />);
    rerender(<Harness value="b" />);
    expect(committed).toEqual(["a|a", "b|b"]);
  });

  it("JsonEditor replaces its text when a different value arrives", () => {
    const { rerender } = render(<JsonEditor value={{ a: 1 }} onChange={() => undefined} />);
    rerender(<JsonEditor value={{ b: 2 }} onChange={() => undefined} />);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toContain('"b": 2');
  });

  it("AsyncSelect shows a new initial label in the same render", () => {
    const load = async () => [];
    const { rerender } = render(
      <AsyncSelect value="1" initialLabel="Ann" onChange={() => undefined} loadOptions={load} />,
    );
    rerender(
      <AsyncSelect value="2" initialLabel="Bob" onChange={() => undefined} loadOptions={load} />,
    );
    expect(screen.getByRole("combobox").textContent).toContain("Bob");
  });
});
