"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { ChatDrawer } from "@/components/incidents/cda/ChatDrawer";
import { useAuth } from "@/contexts/auth-context";

const SUGGESTIONS = [
  "Explain a MITRE ATT&CK technique.",
  "Help me write a CrowdStrike query.",
  "Draft a short incident summary."
];

/** Floating "CDA Chat" button. Hidden on the login page and inside a record, where Investigate Further takes over. */
export function CdaChatLauncher() {
  const { user } = useAuth();
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);

  const insideRecord = /^\/incidents\/[^/]+/.test(pathname);
  if (!user || pathname === "/login" || insideRecord) return null;

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-[#86BC25] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(0,0,0,0.25)] transition-colors hover:bg-[#6FA01E]"
        >
          <Sparkles className="size-4" />
          CDA Chat
        </button>
      ) : null}
      <ChatDrawer
        open={open}
        onOpenChange={setOpen}
        path="/api/chat"
        title="CDA Chat"
        subtitle="General assistant, private to you"
        intro="Ask anything about security operations."
        emptyContext="This chat has no access to your tickets or tools. For a record, use Investigate Further on the record itself."
        suggestions={SUGGESTIONS}
        composerPlaceholder="Ask CDA…"
        canClear
      />
    </>
  );
}
