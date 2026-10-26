"use client";

import { useCallback, useRef, useState } from "react";
import useSWR from "swr";
import apiClient from "@/lib/api-client";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  userName?: string | null;
  runId?: string | null;
  tools?: string[];
  createdAt: string;
}

export interface RunContext {
  available: boolean;
  inProgress: boolean;
  runId: string | null;
  agentId: string | null;
  completedAt: string | null;
}

export interface ChatHistory {
  messages: ChatMessage[];
  runContext?: RunContext;
}

type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "tool"; name: string }
  | { type: "done"; messageId: string }
  | { type: "error"; message: string };

/** `path` is the chat endpoint: `/api/chat` (CDA Chat) or `/api/incidents/{id}/chat` (Investigate Further). */
export function useChatHistory(path: string, enabled: boolean) {
  return useSWR<ChatHistory>(enabled ? path : null, (p: string) => apiClient.get<ChatHistory>(p), {
    revalidateOnFocus: false
  });
}

export async function clearChat(path: string): Promise<void> {
  await apiClient.delete(path);
}

/** Streams one turn. `pending` holds the in-flight user/assistant pair until history revalidates. */
export function useChatStream(path: string, onSettled: () => Promise<unknown>) {
  const [pending, setPending] = useState<{ user: string; assistant: string; tools: string[] } | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastText, setLastText] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;
      const controller = new AbortController();
      abortRef.current = controller;
      setError(null);
      setLastText(trimmed);
      setIsStreaming(true);
      setPending({ user: trimmed, assistant: "", tools: [] });
      let failed = false;
      try {
        await apiClient.stream<StreamEvent>(
          path,
          { message: trimmed },
          (event) => {
            if (event.type === "delta") {
              setPending((p) => (p ? { ...p, assistant: p.assistant + event.text } : p));
            } else if (event.type === "tool") {
              setPending((p) => (p ? { ...p, tools: [...p.tools, event.name] } : p));
            } else if (event.type === "error") {
              failed = true;
              setError(event.message);
            }
          },
          controller.signal
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          failed = true;
          setError(err instanceof Error ? err.message : "CDA request failed.");
        }
      } finally {
        abortRef.current = null;
        setIsStreaming(false);
        // On success the server has persisted the pair, so history replaces the pending bubbles.
        if (!failed) setLastText(null);
        await onSettled();
        setPending(failed ? { user: trimmed, assistant: "", tools: [] } : null);
      }
    },
    [path, isStreaming, onSettled]
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const dismissError = useCallback(() => {
    setError(null);
    setPending(null);
  }, []);

  return { pending, isStreaming, error, lastText, send, stop, dismissError };
}
