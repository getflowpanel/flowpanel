import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { DefaultAvatar } from "../_atoms/AvatarDefault";
import { Badge } from "../_atoms/Badge";
import { LiveIndicator } from "../_atoms/LiveIndicator";
import { Mono } from "../_atoms/Mono";
import { ColumnResizer } from "../_data/ColumnResizer";
import { FilterBar } from "../_data/FilterBar";
import { TagInput } from "../_data/TagInput";
import { DefaultSkeletonTable } from "../_feedback/SkeletonTableDefault";
import { AsyncSelect } from "../_forms/AsyncSelect";
import { FormSection } from "../_forms/FormSection";
import { Brand } from "../_shell/Brand";
import { Breadcrumbs } from "../_shell/Breadcrumbs";
import { DetailShell } from "../_shell/DetailShell";
import { cn } from "../lib/cn";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Skeleton } from "../ui/skeleton";

afterEach(cleanup);

const MARKER = "host-override";
const OVERRIDE = [
  MARKER,
  "p-1 px-1 py-1 m-1 mb-1",
  "text-lg text-red-600 font-bold",
  "bg-white rounded-none border-0 border-red-500 shadow-none",
  "flex-col items-start justify-start gap-0 space-y-0",
  "w-auto h-auto overflow-visible inline-block",
].join(" ");

const noop = () => {};

const components: [string, (className: string) => ReactElement][] = [
  ["DefaultAvatar", (c) => <DefaultAvatar fallback="AB" className={c} />],
  ["DefaultAvatar with src", (c) => <DefaultAvatar src="/a.png" alt="A" className={c} />],
  ["LiveIndicator", (c) => <LiveIndicator status="live" className={c} />],
  ["ColumnResizer", (c) => <ColumnResizer onResize={noop} onResizeEnd={noop} className={c} />],
  ["FilterBar", (c) => <FilterBar filters={[]} values={{}} onChange={noop} className={c} />],
  ["TagInput", (c) => <TagInput value={["a"]} onChange={noop} className={c} />],
  ["DefaultSkeletonTable", (c) => <DefaultSkeletonTable className={c} />],
  [
    "AsyncSelect",
    (c) => <AsyncSelect value={null} onChange={noop} loadOptions={async () => []} className={c} />,
  ],
  [
    "FormSection",
    (c) => (
      <FormSection label="Profile" className={c}>
        x
      </FormSection>
    ),
  ],
  ["Brand", (c) => <Brand brand={{ name: "Acme" }} className={c} />],
  ["Brand link", (c) => <Brand brand={{ name: "Acme", href: "/" }} className={c} />],
  ["Breadcrumbs", (c) => <Breadcrumbs items={[{ label: "Home" }]} className={c} />],
  [
    "DetailShell",
    (c) => (
      <DetailShell title="Order" className={c}>
        x
      </DetailShell>
    ),
  ],
  ["Badge", (c) => <Badge className={c}>A</Badge>],
  ["Mono", (c) => <Mono className={c}>a1</Mono>],
  ["Button", (c) => <Button className={c}>Save</Button>],
  ["Input", (c) => <Input className={c} />],
  ["Label", (c) => <Label className={c}>Name</Label>],
  ["Skeleton", (c) => <Skeleton className={c} />],
];

describe("a className passed to a FlowPanel component", () => {
  it.each(components)("%s: replaces every kit class it conflicts with", (_name, element) => {
    const { container } = render(element(OVERRIDE));
    const target = container.querySelector(`.${MARKER}`);
    expect(target).not.toBeNull();
    const classes = (target?.getAttribute("class") ?? "").split(/\s+/);
    for (const token of OVERRIDE.split(" ")) expect(classes).toContain(token);
    const conflicting = classes.filter(
      (token) => token.startsWith("fp-") && !cn(token, OVERRIDE).split(" ").includes(token),
    );
    expect(conflicting).toEqual([]);
  });
});
