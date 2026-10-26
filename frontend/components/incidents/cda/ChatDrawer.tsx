"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowDown, ArrowUpRight, Maximize2, Minimize2, Sparkles, Trash2, X } from "lucide-react";
import { CdaComposer } from "@/components/incidents/cda/CdaComposer";
import { CdaMessage } from "@/components/incidents/cda/CdaMessage";
import { clearChat, useChatHistory, useChatStream, type ChatHistory } from "@/hooks/use-chat";

const MIN_WIDTH = 420;
const DEFAULT_WIDTH = 720;
const DOCK_MIN_VIEWPORT = 1024;
const WIDTH_KEY = "cda.dockWidth";

function clampWidth(width: number): number {
  const max = Math.min(1100, Math.round(window.innerWidth * 0.7));
  return Math.max(MIN_WIDTH, Math.min(width, max));
}

function readStoredWidth(): number {
  try {
    const stored = Number(window.localStorage.getItem(WIDTH_KEY));
    return stored ? clampWidth(stored) : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chat endpoint: `/api/chat` or `/api/incidents/{id}/chat`. */
  path: string;
  title: string;
  subtitle: string;
  /** Shown above the thread (e.g. which run is being continued). */
  banner?: React.ReactNode;
  /** When set, the chat is blocked and this message is shown instead of the composer. */
  unavailableReason?: string | null;
  intro: string;
  /** Extra context shown with the intro while the thread is empty. */
  emptyContext?: React.ReactNode;
  suggestions: string[];
  composerPlaceholder: string;
  canClear?: boolean;
  onAddToNotes?: (text: string) => Promise<void>;
  /** Lets a wrapper read the history response (e.g. run-context availability). */
  onHistory?: (history: ChatHistory | undefined) => void;
}

export function ChatDrawer({
  open,
  onOpenChange,
  path,
  title,
  subtitle,
  banner,
  unavailableReason,
  intro,
  emptyContext,
  suggestions,
  composerPlaceholder,
  canClear,
  onAddToNotes,
  onHistory
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [focus, setFocus] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showJump, setShowJump] = useState(false);

  const history = useChatHistory(path, open);
  const { pending, isStreaming, error, lastText, send, stop, dismissError } = useChatStream(path, () =>
    history.mutate()
  );
  const messages = history.data?.messages ?? [];

  useEffect(() => setWidth(readStoredWidth()), []);

  // Dock: on wide screens the page makes room for the chat. Focus mode overlays instead.
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const docked = open && !focus && window.innerWidth >= DOCK_MIN_VIEWPORT;
      if (docked) root.style.setProperty("--cda-dock", `${clampWidth(width)}px`);
      else root.style.removeProperty("--cda-dock");
    };
    apply();
    window.addEventListener("resize", apply);
    return () => {
      window.removeEventListener("resize", apply);
      root.style.removeProperty("--cda-dock");
    };
  }, [open, focus, width]);

  useEffect(() => {
    onHistory?.(history.data);
  }, [history.data, onHistory]);

  const scrollToEnd = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    if (stickRef.current) scrollToEnd();
  }, [messages.length, pending?.assistant, pending?.tools.length, open, scrollToEnd]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    stickRef.current = nearBottom;
    setShowJump(!nearBottom);
  }

  function startResize(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(true);
    const onMove = (e: PointerEvent) => setWidth(clampWidth(window.innerWidth - e.clientX));
    const onUp = (e: PointerEvent) => {
      setDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      try {
        window.localStorage.setItem(WIDTH_KEY, String(clampWidth(window.innerWidth - e.clientX)));
      } catch {
        // storage unavailable; width just isn't remembered
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  async function handleClear() {
    if (!window.confirm(`Clear your ${title} history?`)) return;
    await clearChat(path);
    await history.mutate();
  }

  const empty = messages.length === 0 && !pending;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          onInteractOutside={(e) => e.preventDefault()}
          aria-describedby={undefined}
          style={focus ? undefined : { width }}
          className={`fixed inset-y-0 right-0 z-50 flex h-full max-w-full flex-col border-l border-[var(--dl-border-strong)] bg-[#FBFBF9] shadow-[-12px_0_32px_rgba(0,0,0,0.14)] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right ${
            focus ? "w-[min(1200px,92vw)]" : "w-full"
          } ${dragging ? "select-none" : ""}`}
        >
          {!focus ? (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize chat"
              onPointerDown={startResize}
              onDoubleClick={() => setWidth(DEFAULT_WIDTH)}
              className="absolute inset-y-0 -left-1 z-10 hidden w-2 cursor-col-resize sm:block"
            >
              <span
                className={`absolute inset-y-0 left-[3px] w-[2px] transition-colors ${
                  dragging ? "bg-[#86BC25]" : "bg-transparent hover:bg-[#86BC25]/60"
                }`}
              />
            </div>
          ) : null}

          <header className="relative flex items-center gap-3 bg-[#1B1B1A] px-5 py-3.5 text-white">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#86BC25]">
              <Sparkles className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-[15px] font-semibold leading-tight">{title}</DialogPrimitive.Title>
              <p className="truncate text-[12px] text-[#B9B9B4]">{subtitle}</p>
            </div>
            {canClear && messages.length > 0 ? (
              <button type="button" onClick={handleClear} title="Clear history" aria-label="Clear history" className="rounded-md p-1.5 text-[#B9B9B4] transition-colors hover:bg-white/10 hover:text-white">
                <Trash2 className="size-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setFocus((f) => !f)}
              title={focus ? "Back to side panel" : "Focus view"}
              aria-label={focus ? "Back to side panel" : "Focus view"}
              className="hidden rounded-md p-1.5 text-[#B9B9B4] transition-colors hover:bg-white/10 hover:text-white sm:block"
            >
              {focus ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
            <DialogPrimitive.Close className="rounded-md p-1.5 text-[#B9B9B4] transition-colors hover:bg-white/10 hover:text-white" aria-label={`Close ${title}`}>
              <X className="size-4" />
            </DialogPrimitive.Close>
            <div className="cda-trace" data-live={isStreaming ? "true" : "false"} />
          </header>

          {banner ? (
            <div className="border-b border-[var(--dl-border)] bg-white px-5 py-2 text-[12px] text-[var(--dl-text-secondary)]">{banner}</div>
          ) : null}

          <div className="relative min-h-0 flex-1">
            <div ref={scrollRef} onScroll={onScroll} className="h-full space-y-6 overflow-y-auto overflow-x-hidden px-5 py-5">
              {history.isLoading ? <p className="text-[12px] text-[var(--dl-text-secondary)]">Loading</p> : null}
              {unavailableReason ? (
                <p className="rounded-xl border border-[var(--dl-border)] bg-white px-4 py-3 text-[13px] text-[var(--dl-text-secondary)]">
                  {unavailableReason}
                </p>
              ) : null}

              {empty && !history.isLoading && !unavailableReason ? (
                <div className="mx-auto max-w-[520px] space-y-4 pt-8">
                  <div>
                    <p className="text-[17px] font-semibold text-[#1B1B1A]">{intro}</p>
                    {emptyContext ? <div className="mt-2 text-[13px] text-[var(--dl-text-secondary)]">{emptyContext}</div> : null}
                  </div>
                  <ul className="space-y-2">
                    {suggestions.map((s) => (
                      <li key={s}>
                        <button
                          type="button"
                          onClick={() => send(s)}
                          className="group flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--dl-border-strong)] bg-white px-4 py-3 text-left text-[13.5px] transition-all hover:border-[#86BC25] hover:shadow-[0_2px_10px_rgba(134,188,37,0.18)]"
                        >
                          {s}
                          <ArrowUpRight className="size-4 shrink-0 text-[#B5B5B0] transition-colors group-hover:text-[#5A8217]" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {messages.map((m) => (
                <CdaMessage
                  key={m.id}
                  role={m.role}
                  content={m.content}
                  userName={m.role === "user" ? m.userName : null}
                  tools={m.tools}
                  onAddToNotes={m.role === "assistant" ? onAddToNotes : undefined}
                />
              ))}

              {pending ? (
                <>
                  <CdaMessage role="user" content={pending.user} userName={null} />
                  {!error ? (
                    <CdaMessage role="assistant" content={pending.assistant} streaming={isStreaming} tools={pending.tools} />
                  ) : null}
                </>
              ) : null}

              {error ? (
                <div className="rounded-xl border border-[rgba(218,41,28,0.25)] bg-[#FDEEEC] px-4 py-3 text-[13px] text-[#8B0F08]">
                  <p>{error}</p>
                  <div className="mt-2 flex gap-4 font-semibold">
                    {lastText ? (
                      <button
                        type="button"
                        onClick={() => {
                          const text = lastText;
                          dismissError();
                          void send(text);
                        }}
                        className="hover:underline"
                      >
                        Retry
                      </button>
                    ) : null}
                    <button type="button" onClick={dismissError} className="hover:underline">
                      Dismiss
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {showJump ? (
              <button
                type="button"
                onClick={() => {
                  stickRef.current = true;
                  scrollToEnd(true);
                }}
                className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[#1B1B1A] px-3 py-1.5 text-[12px] font-medium text-white shadow-lg transition-colors hover:bg-black"
              >
                <ArrowDown className="size-3.5" />
                Jump to latest
              </button>
            ) : null}
          </div>

          <CdaComposer
            isStreaming={isStreaming}
            disabled={!!unavailableReason}
            onSend={(t) => void send(t)}
            onStop={stop}
            placeholder={composerPlaceholder}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
