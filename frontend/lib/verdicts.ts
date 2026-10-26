/** The four triage verdicts. Mirrors backend/app/utils/verdicts.py. */
export const VERDICT_LABELS: Record<string, string> = {
  true_positive: "True Positive",
  false_positive: "False Positive",
  escalate_l2: "Escalate to L2",
  benign_tp: "True Positive Benign"
};
