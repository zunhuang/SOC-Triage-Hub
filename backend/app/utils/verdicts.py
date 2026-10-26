"""The four triage verdicts used everywhere (extraction, validation, UI labels)."""
from __future__ import annotations

from typing import Literal

Verdict = Literal["true_positive", "false_positive", "escalate_l2", "benign_tp"]

VERDICT_LABELS: dict[str, str] = {
    "true_positive": "True Positive",
    "false_positive": "False Positive",
    "escalate_l2": "Escalate to L2",
    "benign_tp": "True Positive Benign",
}
