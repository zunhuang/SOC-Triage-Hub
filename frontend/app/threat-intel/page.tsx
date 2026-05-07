"use client";

import { QueuePage } from "@/components/queue/QueuePage";
import type { QueueMeta } from "@/components/queue/QueuePage";

const META: QueueMeta = {
  queueType: "threat_intel",
  accentColor: "#E87722",
  eyebrow: "Threat Intelligence",
  title: "IOC Sweep",
  titleAccent: "Workbench",
  slogan: "Surface signals, accelerate decisions",
  heroBadge: "THREAT INTELLIGENCE",
  heroMottoPrefix: "",
  heroMottoAccent: "Surface",
  heroMottoSuffix: " the unseen, before it surfaces you.",
  heroStats: "94% IOCs auto-enriched · 4 feed sources",
  heroStrip: "Feed ingestion · IOC enrichment · TTP mapping · Threat scoring · Intel brief",
};

export default function ThreatIntelPage() {
  return <QueuePage meta={META} />;
}
