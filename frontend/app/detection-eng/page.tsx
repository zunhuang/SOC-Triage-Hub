"use client";

import { QueuePage } from "@/components/queue/QueuePage";
import type { QueueMeta } from "@/components/queue/QueuePage";

const META: QueueMeta = {
  queueType: "detection_eng",
  accentColor: "#6366F1",
  eyebrow: "Detection Engineering",
  title: "Tuning",
  titleAccent: "Workbench",
  slogan: "Tune faster, detect smarter",
  heroBadge: "DETECTION ENGINEERING",
  heroMottoPrefix: "Close the ",
  heroMottoAccent: "gap",
  heroMottoSuffix: " before they find it.",
  heroStats: "67% FP reduction · 28 rules tuned",
  heroStrip: "Alert review · Rule analysis · Coverage mapping · Tuning rec · Validation",
};

export default function DetectionEngPage() {
  return <QueuePage meta={META} />;
}
