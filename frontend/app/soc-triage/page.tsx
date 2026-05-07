"use client";

import { QueuePage } from "@/components/queue/QueuePage";
import type { QueueMeta } from "@/components/queue/QueuePage";

const META: QueueMeta = {
  queueType: "soc_triage",
  accentColor: "#86BC25",
  eyebrow: "SOC L1 Triage",
  title: "Triage",
  titleAccent: "Workbench",
  slogan: "Triage at scale, eyes on where it matters",
  heroBadge: "CYBER DIGITAL ANALYST",
  heroMottoPrefix: "Triage at scale, ",
  heroMottoAccent: "eyes-on",
  heroMottoSuffix: " where it matters.",
  heroStats: "86% auto-triaged · 5 step pipeline",
  heroStrip: "Alert triage · UDM correlation · IOC enrichment · SIEM evidence · Verdict",
};

export default function SocTriagePage() {
  return <QueuePage meta={META} />;
}
