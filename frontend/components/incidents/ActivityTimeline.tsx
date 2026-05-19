"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  Bot,
  ExternalLink,
  FileText,
  PenLine,
  Send,
  ShieldCheck,
  UserCheck,
  MessageSquare,
} from "lucide-react";
import { addComment } from "@/hooks/use-incidents";
import type { Incident } from "@/types/incident";

const ACTION_CONFIG: Record<
  string,
  { icon: React.ElementType; label: string; iconColor: string; bgColor: string }
> = {
  comment: { icon: MessageSquare, label: "Comment", iconColor: "#86BC25", bgColor: "#F1F8E5" },
  triage: { icon: Bot, label: "AI Triage", iconColor: "#005587", bgColor: "#E5F6FC" },
  post_to_jira: { icon: ExternalLink, label: "Posted to Jira", iconColor: "#6B6B6B", bgColor: "#F0F0F0" },
  note: { icon: FileText, label: "Note", iconColor: "#D97706", bgColor: "#FEF4E6" },
  assign: { icon: UserCheck, label: "Assignment", iconColor: "#86BC25", bgColor: "#F1F8E5" },
  assessment: { icon: PenLine, label: "Assessment", iconColor: "#005587", bgColor: "#E5F6FC" },
  verdict_override: { icon: ShieldCheck, label: "Verdict Override", iconColor: "#5A8217", bgColor: "#F1F8E5" },
};

const DEFAULT_CONFIG = {
  icon: Activity,
  label: "Activity",
  iconColor: "#9B9B9B",
  bgColor: "#F4F4F4",
};

interface Props {
  incident: Incident;
  mutate: () => void;
}

export function ActivityTimeline({ incident, mutate }: Props) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const entries = [...(incident.activityLog ?? [])].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      await addComment(incident._id, text.trim());
      setText("");
      mutate();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-[12px] border border-[var(--dl-border)] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-[var(--dl-border)] px-6 py-4">
        <Activity className="size-4 text-[var(--dl-text-secondary)]" />
        <span className="font-semibold text-[var(--foreground)]">Activity</span>
        {entries.length > 0 && (
          <span className="ml-1 rounded-full bg-[#F0F0F0] px-2 py-0.5 text-[11px] font-bold text-[#666]">
            {entries.length}
          </span>
        )}
      </div>

      {/* Timeline */}
      <div className="px-6 py-2">
        {entries.length === 0 ? (
          <p className="py-6 text-[13px] text-[var(--dl-text-secondary)]">No activity yet.</p>
        ) : (
          <div className="relative">
            <div className="absolute bottom-0 left-4 top-0 w-px bg-[var(--dl-border)]" />
            <div className="space-y-0 py-3">
              {entries.map((entry, i) => {
                const cfg = ACTION_CONFIG[entry.action] ?? DEFAULT_CONFIG;
                const Icon = cfg.icon;
                const isComment = entry.action === "comment";
                return (
                  <div key={i} className="relative flex gap-4 pb-4 last:pb-0">
                    <div
                      className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                      style={{ background: cfg.bgColor }}
                    >
                      {isComment ? (
                        <span
                          className="text-[11px] font-bold"
                          style={{ color: cfg.iconColor }}
                        >
                          {entry.actor?.charAt(0).toUpperCase() ?? "?"}
                        </span>
                      ) : (
                        <Icon className="size-3.5" style={{ color: cfg.iconColor }} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pt-1">
                      <div className="mb-0.5 flex flex-wrap items-baseline gap-2">
                        <span className="text-[12px] font-semibold text-[var(--foreground)]">
                          {isComment ? entry.actor : cfg.label}
                        </span>
                        {isComment && (
                          <span className="text-[11px] text-[var(--dl-text-secondary)]">
                            {entry.actor}
                          </span>
                        )}
                        <span className="text-[11px] text-[var(--dl-text-secondary)]">
                          {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--foreground)]">
                        {entry.details}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Comment input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-[var(--dl-border)] px-6 py-4"
      >
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
              handleSubmit(e as unknown as React.FormEvent);
          }}
          placeholder="Add a comment… (Ctrl+Enter to submit)"
          className="w-full resize-none rounded-md border border-[var(--dl-border)] bg-[#FAFAFA] px-3 py-2 text-[13px] text-[var(--foreground)] outline-none transition-colors placeholder:text-[#B0B0B0] focus:border-[var(--dl-border-strong)] focus:ring-2 focus:ring-[#86BC25]/30"
        />
        <div className="mt-2.5 flex justify-end">
          <button
            type="submit"
            disabled={!text.trim() || submitting}
            className="inline-flex items-center gap-2 rounded-md bg-[#86BC25] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#6FA01E] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="size-3.5" />
            {submitting ? "Posting…" : "Add Comment"}
          </button>
        </div>
      </form>
    </div>
  );
}
