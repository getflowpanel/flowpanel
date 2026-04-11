export function StagePill({ stage, color }: { stage: string; color: string }) {
  return (
    <span
      className="fp:inline-flex fp:items-center fp:gap-1 fp:py-0.5 fp:px-2 fp:rounded fp:text-[11px] fp:font-semibold"
      style={{
        background: `${color}22`,
        color,
      }}
      aria-label={`Stage: ${stage}`}
    >
      {stage}
    </span>
  );
}
