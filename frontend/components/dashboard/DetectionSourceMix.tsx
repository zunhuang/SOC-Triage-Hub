const BAR_COLORS = ["#86BC25", "#00A3E0", "#005587", "#86EB22", "#D97706"];

interface DetectionSourceMixProps {
  sources: { label: string; tag: string; count: number }[];
}

export function DetectionSourceMix({ sources }: DetectionSourceMixProps) {
  const maxCount = Math.max(...sources.map((s) => s.count), 1);

  return (
    <div className="rounded-[10px] border border-[#E6E6E6] bg-white p-[18px_20px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <h4 className="mb-3.5 text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--foreground)]">
        Detection Source Mix
      </h4>

      <div className="space-y-3">
        {sources.map((source, idx) => (
          <div key={source.tag} className="flex items-center gap-2.5">
            <span className="w-[130px] shrink-0 text-xs text-[var(--foreground)]">
              {source.label}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-[3px] bg-[#F0F0F0]">
              <div
                className="h-full rounded-[3px]"
                style={{
                  width: `${(source.count / maxCount) * 100}%`,
                  background: BAR_COLORS[idx % BAR_COLORS.length],
                }}
              />
            </div>
            <span className="w-7 text-right text-xs font-semibold tabular-nums text-[var(--foreground)]">
              {source.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
