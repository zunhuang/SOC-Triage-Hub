"use client";

import { Children, isValidElement, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, ClipboardCopy, NotebookPen, Sparkles, Wrench } from "lucide-react";

/** Tool names that are plumbing for finding other tools; not worth showing the analyst. */
const PLUMBING_TOOLS = new Set(["tool_search", "tool_describe"]);

export function humanizeTool(name: string): string {
  if (name === "tool_call") return "Running a tool";
  return name
    .replace(/^crowdstrike-falcon_/, "CrowdStrike ")
    .replace(/[-_]+/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function summarizeTools(tools: string[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const t of tools) {
    if (PLUMBING_TOOLS.has(t)) continue;
    const label = humanizeTool(t);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts].map(([label, count]) => ({ label, count }));
}

function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  return [
    copied,
    (text) => {
      void navigator.clipboard?.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }
  ];
}

function textOf(node: React.ReactNode): string {
  return Children.toArray(node)
    .map((c) => (typeof c === "string" || typeof c === "number" ? String(c) : isValidElement(c) ? textOf((c.props as { children?: React.ReactNode }).children) : ""))
    .join("");
}

function InlineCode({ children }: { children: React.ReactNode }) {
  const [copied, copy] = useCopy();
  const text = textOf(children);
  return (
    <code
      title={copied ? "Copied" : "Click to copy"}
      onClick={() => copy(text)}
      className={copied ? "!bg-[#86BC25] !text-white" : undefined}
    >
      {children}
    </code>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  const [copied, copy] = useCopy();
  return (
    <div className="group/code relative my-3">
      <button
        type="button"
        onClick={() => copy(textOf(children).replace(/\n$/, ""))}
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] text-[#D8D8D8] opacity-0 transition-opacity hover:bg-white/20 focus:opacity-100 group-hover/code:opacity-100"
      >
        {copied ? <Check className="size-3" /> : <ClipboardCopy className="size-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="!my-0 max-w-full overflow-x-auto">{children}</pre>
    </div>
  );
}

const markdownComponents: Components = {
  table: ({ children }) => (
    <div className="my-3 max-h-[420px] max-w-full overflow-auto rounded-lg border border-[var(--dl-border)] bg-white">
      <table>{children}</table>
    </div>
  ),
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
  code: ({ className, children }) => {
    const isBlock = /language-/.test(className ?? "") || String(children).includes("\n");
    return isBlock ? <code className={className}>{children}</code> : <InlineCode>{children}</InlineCode>;
  }
};

interface Props {
  role: "user" | "assistant";
  content: string;
  userName?: string | null;
  streaming?: boolean;
  tools?: string[];
  onAddToNotes?: (text: string) => Promise<void>;
}

export function CdaMessage({ role, content, userName, streaming, tools = [], onAddToNotes }: Props) {
  const [copied, copy] = useCopy();
  const [noted, setNoted] = useState(false);

  if (role === "user") {
    return (
      <div className="flex flex-col items-end gap-1">
        {userName ? <span className="text-[11px] text-[var(--dl-text-secondary)]">{userName}</span> : null}
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-[#1B1B1A] px-4 py-2.5 text-[13.5px] leading-relaxed text-white">
          {content}
        </div>
      </div>
    );
  }

  const toolChips = summarizeTools(tools);
  const waiting = streaming && !content;

  return (
    <div className="group flex min-w-0 gap-3">
      <div className="flex w-6 shrink-0 flex-col items-center gap-1.5">
        <span className="grid size-6 place-items-center rounded-full bg-[#86BC25] text-white" aria-hidden>
          <Sparkles className="size-3.5" />
        </span>
        <div className="cda-rail min-h-4 flex-1" data-live={streaming ? "true" : "false"} data-done={streaming ? "false" : "true"} />
      </div>

      <div className="min-w-0 flex-1 pb-1">
        {toolChips.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {toolChips.map(({ label, count }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 rounded-full border border-[#E9C98F] bg-[#FEF6E7] px-2 py-0.5 text-[11px] font-medium text-[#8A4B08]"
              >
                <Wrench className="size-3" />
                {label}
                {count > 1 ? ` x${count}` : ""}
              </span>
            ))}
          </div>
        ) : null}

        {waiting ? (
          <span className="inline-flex h-5 items-center gap-1" role="status" aria-label="CDA is thinking">
            <span className="cda-dot" />
            <span className="cda-dot" />
            <span className="cda-dot" />
          </span>
        ) : null}

        {content ? (
          <div className="triage-prose cda-prose prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {content}
            </ReactMarkdown>
          </div>
        ) : null}

        {!streaming && content ? (
          <div className="mt-2 flex gap-3 text-[11.5px] text-[var(--dl-text-secondary)] opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <button type="button" className="inline-flex items-center gap-1 hover:text-[var(--foreground)]" onClick={() => copy(content)}>
              {copied ? <Check className="size-3" /> : <ClipboardCopy className="size-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
            {onAddToNotes ? (
              <button
                type="button"
                disabled={noted}
                className="inline-flex items-center gap-1 hover:text-[var(--foreground)] disabled:opacity-60"
                onClick={async () => {
                  await onAddToNotes(content);
                  setNoted(true);
                }}
              >
                {noted ? <Check className="size-3" /> : <NotebookPen className="size-3" />}
                {noted ? "Added to notes" : "Add to notes"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
