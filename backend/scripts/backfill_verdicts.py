"""One-time script to backfill verdict fields on existing triaged incidents."""
import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.services.triage_orchestrator import _extract_verdict


async def main():
    client = AsyncIOMotorClient(settings.MONGODB_URI, tls=True, tlsAllowInvalidCertificates=True)
    db = client[settings.MONGODB_DB_NAME]

    cursor = db.incidents.find({
        "triageResults.agentOutput": {"$exists": True, "$ne": ""},
        "triageResults.verdict": {"$exists": False},
    })

    count = 0
    updated = 0

    async for incident in cursor:
        count += 1
        jira_key = incident.get("jiraKey", "?")
        raw_text = incident.get("triageResults", {}).get("agentOutput", "")
        if not raw_text or raw_text.startswith("Triage failed"):
            print(f"  [{jira_key}] skipping — no valid output")
            continue

        verdict, verdict_summary = _extract_verdict(raw_text)

        if verdict:
            await db.incidents.update_one(
                {"_id": incident["_id"]},
                {"$set": {
                    "triageResults.verdict": verdict,
                    "triageResults.verdictSummary": verdict_summary,
                }},
            )
            updated += 1
            print(f"  [{jira_key}] {verdict} — {verdict_summary[:120] if verdict_summary else '(no headline)'}")
        else:
            print(f"  [{jira_key}] no verdict keyword found, skipping")

    print(f"\nDone. Scanned {count} incidents, updated {updated}.")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
