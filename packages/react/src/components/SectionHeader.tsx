interface SectionHeaderProps {
  label: string;
  meta?: string;
}

export function SectionHeader({ label, meta }: SectionHeaderProps) {
  return (
    <div className="fp:flex fp:items-baseline fp:justify-between fp:mb-3 fp:mt-0">
      <span className="fp:text-[11px] fp:font-semibold fp:tracking-[0.05em] fp:uppercase fp:text-muted-foreground">
        {label}
      </span>
      {meta && <span className="fp:text-xs fp:text-muted-foreground fp:font-normal">{meta}</span>}
    </div>
  );
}
