"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";

const MAX_LENGTH = 4000;

interface Props {
  isStreaming: boolean;
  disabled?: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  placeholder?: string;
}

export function CdaComposer({ isStreaming, disabled, onSend, onStop, placeholder }: Props) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value]);

  function submit() {
    const text = value.trim();
    if (!text || isStreaming || disabled) return;
    onSend(text);
    setValue("");
  }

  const nearLimit = value.length > MAX_LENGTH - 500;

  return (
    <div className="border-t border-[var(--dl-border)] bg-[#FBFBF9] px-4 pb-4 pt-3">
      <div className="flex items-end gap-2 rounded-2xl border border-[var(--dl-border-strong)] bg-white p-2 pl-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow focus-within:border-[#86BC25] focus-within:shadow-[0_0_0_3px_rgba(134,188,37,0.22)]">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          maxLength={MAX_LENGTH}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder ?? "Ask CDA"}
          aria-label="Message CDA"
          className="max-h-[180px] flex-1 resize-none bg-transparent py-1.5 text-[13.5px] leading-relaxed outline-none placeholder:text-[#9A9A9A] disabled:opacity-50"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop"
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#1B1B1A] text-white transition-colors hover:bg-black"
          >
            <Square className="size-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!value.trim() || disabled}
            aria-label="Send"
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#86BC25] text-white transition-all hover:bg-[#6FA01E] disabled:cursor-not-allowed disabled:bg-[#D9DCD2]"
          >
            <ArrowUp className="size-4" strokeWidth={2.5} />
          </button>
        )}
      </div>
      <p className="mt-1.5 flex justify-between px-1 text-[11px] text-[#8A8A8A]">
        <span>Enter to send, Shift+Enter for a new line</span>
        {nearLimit ? (
          <span className={value.length >= MAX_LENGTH ? "text-[#DA291C]" : ""}>
            {value.length}/{MAX_LENGTH}
          </span>
        ) : null}
      </p>
    </div>
  );
}
