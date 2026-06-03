import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useOptimisticAction } from "../useOptimisticAction.js";

type Row = { count: number };

let captured: {
  value: Row;
  run: (patch: Partial<Row>, action: () => Promise<void>) => Promise<void>;
  pending: boolean;
};

const Harness: React.FC<{ server: Row }> = ({ server }) => {
  const [value, run, pending] = useOptimisticAction<Row, Partial<Row>>(
    server,
    (current, patch) => ({ ...current, ...patch }),
  );
  captured = { value, run, pending };
  return <div data-testid="count">{value.count}</div>;
};

describe("useOptimisticAction", () => {
  afterEach(cleanup);

  it("applies the optimistic value immediately while the action is in flight", async () => {
    const { getByTestId } = render(<Harness server={{ count: 0 }} />);
    expect(getByTestId("count").textContent).toBe("0");

    let resolveAction!: () => void;
    const action = () => new Promise<void>((r) => (resolveAction = r));

    let runPromise!: Promise<void>;
    await act(async () => {
      runPromise = captured.run({ count: 5 }, action);
    });
    // The optimistic patch is visible before the action settles, even though
    // the server value is still 0.
    expect(getByTestId("count").textContent).toBe("5");

    await act(async () => {
      resolveAction();
      await runPromise;
    });
    // After the transition completes with no new server value, React drops the
    // optimistic value and reconciles back to `serverValue`. A host normally
    // refreshes the server value to the patched one (router.refresh / RSC
    // re-stream) before this point.
    expect(getByTestId("count").textContent).toBe("0");
  });

  it("auto-reverts and rejects the returned promise when the action throws", async () => {
    const { getByTestId } = render(<Harness server={{ count: 0 }} />);

    const boom = new Error("nope");
    let rejected: unknown;
    await act(async () => {
      await captured
        .run({ count: 9 }, async () => {
          throw boom;
        })
        .catch((e) => {
          rejected = e;
        });
    });

    // The promise rejects with the original error...
    expect(rejected).toBe(boom);
    // ...and the optimistic value is rolled back to the server value.
    expect(getByTestId("count").textContent).toBe("0");
  });
});
