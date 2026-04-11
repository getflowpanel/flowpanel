import { useDrawerURL } from "../hooks/useDrawerURL.js";
import { useFlowPanelConfig } from "../context.js";
import { ErrorBoundary } from "../components/ErrorBoundary.js";
import { DrawerSection } from "./DrawerSection.js";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../components/ui/sheet.js";

interface SectionConfig {
  type: string;
  showIf?: "hasError" | "hasMeta" | "isRunning";
}

const DEFAULT_SECTIONS: SectionConfig[] = [
  { type: "stat-grid" },
  { type: "timeline" },
  { type: "kv-grid", showIf: "hasMeta" },
  { type: "error-block", showIf: "hasError" },
];

export function DrawerFromURL() {
  const { runId, close } = useDrawerURL();
  const config = useFlowPanelConfig();

  if (!runId) return null;

  const drawerConfig = (config as any).drawers?.runDetail as
    | { sections?: SectionConfig[] }
    | undefined;
  const sections = drawerConfig?.sections ?? DEFAULT_SECTIONS;

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Run {runId}</SheetTitle>
        </SheetHeader>
        <div className="fp:flex fp:flex-col fp:gap-3 fp:px-6 fp:py-4 fp:overflow-y-auto fp:flex-1">
          {sections.map((section, i) => (
            <ErrorBoundary key={`${section.type}-${i}`}>
              <DrawerSection
                type={section.type}
                runId={runId}
                drawerType="runDetail"
                showIf={section.showIf}
              />
            </ErrorBoundary>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
