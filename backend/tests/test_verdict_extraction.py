from app.services.triage_orchestrator import _extract_verdict


def test_heading_without_value_is_skipped():
    report = "### 12. Verdict & Justification\n\n**Verdict: Escalate to L2**\n\nrationale"
    assert _extract_verdict(report) == ("escalate_l2", "Escalate to L2")


def test_heading_with_bold_value():
    assert _extract_verdict("### Verdict: **False Positive**\n") == ("false_positive", "False Positive")


def test_table_row_verdict():
    report = "| Type | IOC | Verdict | Context |\n|--|--|--|--|\n| **Verdict** | **False Positive** |\n"
    assert _extract_verdict(report) == ("false_positive", "False Positive")


def test_all_escalation_wording_maps_to_escalate_l2():
    for text in ("Verdict: Escalate to analyst\n", "Verdict: Requires analyst review\n", "Verdict: Escalate\n"):
        assert _extract_verdict(text)[0] == "escalate_l2"


def test_only_four_verdict_values_are_produced():
    from app.utils.verdicts import VERDICT_LABELS
    from app.services.triage_orchestrator import _VERDICT_KEYWORDS

    assert {v for _, v in _VERDICT_KEYWORDS} <= set(VERDICT_LABELS)


def test_fallback_keyword_scan_without_verdict_line():
    assert _extract_verdict("This is a benign true positive.")[0] == "benign_tp"
