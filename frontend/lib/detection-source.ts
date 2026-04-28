const SOURCE_PATTERNS: [RegExp, string, string][] = [
  [/^NFR\s+MXDR/i, "NFR", "NFR"],
  [/MXDR\s+CS\s+Detections/i, "CS", "CrowdStrike (CS)"],
  [/SharePoint|_SharePoint_/i, "SP", "SharePoint M365"],
  [/Google\s+SecOps|Chronicle/i, "GSO", "Google SecOps"],
  [/Splunk|SPL/i, "SPL", "Splunk SPL"],
];

export function deriveDetectionSource(summary: string): { tag: string; label: string } | null {
  for (const [pattern, tag, label] of SOURCE_PATTERNS) {
    if (pattern.test(summary)) {
      return { tag, label };
    }
  }
  return null;
}

export function groupByDetectionSource(
  incidents: { summary: string }[]
): { label: string; tag: string; count: number }[] {
  const map = new Map<string, { label: string; tag: string; count: number }>();
  for (const inc of incidents) {
    const source = deriveDetectionSource(inc.summary);
    const key = source?.tag ?? "Other";
    const label = source?.label ?? "Other";
    const entry = map.get(key);
    if (entry) {
      entry.count++;
    } else {
      map.set(key, { label, tag: key, count: 1 });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}
