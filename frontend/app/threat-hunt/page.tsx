"use client";

import { QueuePage } from "@/components/queue/QueuePage";
import type { QueueMeta } from "@/components/queue/QueuePage";

const META: QueueMeta = {
  queueType: "threat_hunt",
  accentColor: "#00A3E0",
  eyebrow: "Threat Hunting",
  title: "Hypothesis",
  titleAccent: "Workbench",
  slogan: "Prove the hypothesis, close the gap",
  heroBadge: "THREAT HUNTING",
  heroMottoPrefix: "The quiet ones are the ",
  heroMottoAccent: "dangerous",
  heroMottoSuffix: " ones.",
  heroStats: "12 hypotheses tested · 340 UDM queries",
  heroStrip: "Hypothesis framing · UDM sweep · Telemetry analysis · Evidence chain · Hunt report",
};

export default function ThreatHuntPage() {
  return <QueuePage meta={META} />;
}
