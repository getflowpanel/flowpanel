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

interface DrawerFromURLProps {
  runIds?: string[];
  onNavigate?: (runId: string) => void;
}

export function DrawerFromURL({ runIds, onNavigate }: DrawerFromURLProps) {
  const { runId, close } = useDrawerURL();
  const config = useFlowPanelConfig();

  if (!runId) return null;

  const drawerConfig = (config as any).drawers?.runDetail as
    | { sections?: SectionConfig[] }
    | undefined;
  const sections = drawerConfig?.sections ?? DEFAULT_SECTIONS;

  const currentIndex = runIds?.indexOf(runId) ?? -1;
  const prevRunId = currentIndex > 0 ? runIds![currentIndex - 1] : null;
  const nextRunId =
    currentIndex >= 0 && runIds && currentIndex < runIds.length - 1
      ? runIds[currentIndex + 1]
      : null;

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <SheetContent>
        <SheetHeader>
          <div className="fp:flex fp:items-center fp:justify-between fp:w-full">
            <div className="fp:flex fp:items-center fp:gap-2">
              {prevRunId && (
                <button
                  onClick={() => onNavigate?.(prevRunId)}
                  aria-label="Previous run"
                  className="fp:p-1 fp:rounded fp:hover:bg-muted fp:text-muted-foreground"
                >
                  ←
                </button>
              )}
              <SheetTitle>Run {runId}</SheetTitle>
              {nextRunId && (
                <button
                  onClick={() => onNavigate?.(nextRunId)}
                  aria-label="Next run"
                  className="fp:p-1 fp:rounded fp:hover:bg-muted fp:text-muted-foreground"
                >
                  →
                </button>
              )}
            </div>
          </div>
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
