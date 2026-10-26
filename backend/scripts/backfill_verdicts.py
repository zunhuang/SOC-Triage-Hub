"""Re-derive triageResults.verdict / verdictSummary from each stored report.

Dry run by default; pass --apply to write. Human overrides (humanVerdict) are never touched.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.services.triage_orchestrator import _extract_verdict


async def main(apply: bool) -> None:
    client = AsyncIOMotorClient(settings.MONGODB_URI, tls=True, tlsAllowInvalidCertificates=True)
    db = client[settings.MONGODB_DB_NAME]

    scanned = changed = 0
    cursor = db.incidents.find({"triageResults.agentOutput": {"$exists": True, "$ne": ""}})
    async for incident in cursor:
        jira_key = incident.get("jiraKey", "?")
        results = incident.get("triageResults", {})
        raw_text = results.get("agentOutput", "")
        if raw_text.startswith("Triage failed"):
            continue
        scanned += 1

        verdict, summary = _extract_verdict(raw_text)
        if verdict is None:
            print(f"  [{jira_key}] no verdict found, left as {results.get('verdict')!r}")
            continue
        if verdict == results.get("verdict") and summary == results.get("verdictSummary"):
            continue

        changed += 1
        print(f"  [{jira_key}] {results.get('verdict')!r} -> {verdict!r} ({summary})")
        if apply:
            await db.incidents.update_one(
                {"_id": incident["_id"]},
                {"$set": {"triageResults.verdict": verdict, "triageResults.verdictSummary": summary}},
            )

    mode = "Updated" if apply else "Would update (dry run, pass --apply)"
    print(f"\nScanned {scanned}. {mode}: {changed}.")
    client.close()


if __name__ == "__main__":
    asyncio.run(main("--apply" in sys.argv))
