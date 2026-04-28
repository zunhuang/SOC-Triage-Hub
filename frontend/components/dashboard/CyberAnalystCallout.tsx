interface CyberAnalystCalloutProps {
  autoTriagePct: number;
}

export function CyberAnalystCallout({ autoTriagePct }: CyberAnalystCalloutProps) {
  return (
    <div className="relative overflow-hidden rounded-[10px] bg-[#282728] p-[18px_20px] text-white">
      {/* Radial glow */}
      <div className="pointer-events-none absolute -bottom-20 -right-20 h-[200px] w-[200px] rounded-full bg-[radial-gradient(circle,rgba(134,235,34,0.18)_0%,rgba(134,235,34,0)_70%)]" />

      <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.10em] text-[#86EB22]">
        Cyber Digital Analyst
      </h4>

      <p className="relative z-[1] mb-3.5 text-[17px] font-light leading-snug">
        Triage at <em className="font-bold not-italic text-[#86EB22]">scale</em>, eyes-on where it matters.
      </p>

      <div className="relative z-[1] mb-1 flex items-baseline gap-2">
        <span className="text-[26px] font-light tabular-nums">{autoTriagePct}%</span>
        <span className="text-xs text-[#B5B5B5]">incidents auto-triaged</span>
      </div>

      <div className="relative z-[1] mb-2.5 flex items-baseline gap-2">
        <span className="text-[26px] font-light tabular-nums">5</span>
        <span className="text-xs text-[#B5B5B5]">step autonomous pipeline</span>
      </div>

      <p className="relative z-[1] mt-2.5 text-[11px] text-[#999]">
        Alert triage &middot; UDM correlation &middot; IOC enrichment &middot; SIEM evidence &middot; Verdict
      </p>
    </div>
  );
}
