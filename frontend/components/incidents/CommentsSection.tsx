"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Send } from "lucide-react";
import { addComment } from "@/hooks/use-incidents";
import type { Incident } from "@/types/incident";

interface Props {
  incident: Incident;
  mutate: () => void;
}

export function CommentsSection({ incident, mutate }: Props) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const comments = (incident.activityLog ?? []).filter((e) => e.action === "comment");

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
        <MessageSquare className="size-4 text-[var(--dl-text-secondary)]" />
        <span className="font-semibold text-[var(--foreground)]">Comments</span>
        {comments.length > 0 && (
          <span className="ml-1 rounded-full bg-[#F0F0F0] px-2 py-0.5 text-[11px] font-bold text-[#666]">
            {comments.length}
          </span>
        )}
      </div>

      {/* Comment list */}
      <div className="divide-y divide-[var(--dl-border)]">
        {comments.length === 0 ? (
          <p className="px-6 py-6 text-[13px] text-[var(--dl-text-secondary)]">
            No comments yet. Be the first to add one.
          </p>
        ) : (
          comments.map((entry, i) => {
            const initial = entry.actor?.charAt(0).toUpperCase() ?? "?";
            return (
              <div key={i} className="flex gap-3.5 px-6 py-4">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#86BC25] to-[#86EB22] text-[12px] font-bold text-black">
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-baseline gap-2">
                    <span className="text-[13px] font-semibold text-[var(--foreground)]">{entry.actor}</span>
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
          })
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-[var(--dl-border)] px-6 py-4">
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(e as unknown as React.FormEvent);
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
