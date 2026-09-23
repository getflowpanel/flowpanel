// @vitest-environment happy-dom

import { resolveFormatting } from "@flowpanel/core/format";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FormattingProvider } from "../../_provider/FormattingContext";
import { FunnelCard } from "../FunnelCard";
import { MetricCard } from "../MetricCard";

afterEach(cleanup);

const ru = resolveFormatting({ locale: "ru-RU" });
const percent = (locale: string, value: number, digits: number) =>
  new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

describe("percentages follow the admin's locale", () => {
  it("formats a metric delta with the locale's decimal separator", () => {
    const { container } = render(
      <FormattingProvider value={ru}>
        <MetricCard label="Отклики" value={12} delta={{ value: 0.194, vs: "прошлая неделя" }} />
      </FormattingProvider>,
    );
    expect(container.textContent).toContain(percent("ru-RU", 0.194, 1));
    expect(container.textContent).not.toContain("19.4");
  });

  it("keeps the English delta as it was", () => {
    const { container } = render(
      <MetricCard label="Visits" value={12} delta={{ value: 0.19, vs: "prev" }} />,
    );
    expect(container.textContent).toContain("19.0%");
  });

  it("formats funnel shares and drop-offs in the locale", () => {
    const { container } = render(
      <FormattingProvider value={ru}>
        <FunnelCard
          steps={[
            { label: "Визиты", value: 1000 },
            { label: "Заявки", value: 250 },
          ]}
        />
      </FormattingProvider>,
    );
    expect(container.textContent).toContain(percent("ru-RU", 0.25, 0));
    expect(container.textContent).toContain(`−${percent("ru-RU", 0.75, 0)}`);
  });
});
