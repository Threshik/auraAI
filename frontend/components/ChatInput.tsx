"use client";

import { useRef, useEffect, useState, KeyboardEvent, ClipboardEvent } from "react";
import { ImagePlus, Mic, MicOff, SendHorizontal, X } from "lucide-react";

// Browser SpeechRecognition API typings (not in default TS lib)
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface ISpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

export interface AttachedFile {
  base64: string;
  mediaType: string;
  fileName: string;
  previewUrl?: string;
}

interface ChatInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSend: () => void;
  readonly disabled: boolean;
  readonly attachedFile: AttachedFile | null;
  readonly onFileAttach: (file: AttachedFile | null) => void;
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  attachedFile,
  onFileAttach,
}: Readonly<ChatInputProps>) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);
  const baseTextRef = useRef("");

  // Handle file -> base64 and optional preview
  function processFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const [header, base64] = dataUrl.split(",");
      const mediaType = header.replace("data:", "").replace(";base64", "");
      const isImage = mediaType.startsWith("image/");
      onFileAttach({
        base64,
        mediaType,
        fileName: file.name,
        previewUrl: isImage ? dataUrl : undefined,
      });
    };
    reader.readAsDataURL(file);
  }

  // Paste: capture image from clipboard (e.g. screenshot paste)
  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) processFile(file);
        return;
      }
    }
  }

  function toggleVoice() {
    const SR = (globalThis as any).SpeechRecognition ?? (globalThis as any).webkitSpeechRecognition;
    if (!SR) {
      alert("Your browser doesn't support voice input. Try Chrome or Edge.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = true;

    baseTextRef.current = value.trimEnd();
    recognitionRef.current = rec;
    setIsListening(true);

    rec.onresult = (e: { results: SpeechRecognitionResultList; resultIndex: number }) => {
      let full = "";
      for (const result of e.results) {
        full += result[0].transcript;
      }
      const prefix = baseTextRef.current ? baseTextRef.current + " " : "";
      onChange(prefix + full.trim());
    };

    rec.onend = () => {
      setIsListening(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    };
    rec.onerror = () => {
      setIsListening(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    };
    rec.start();
  }

  /* Auto-resize textarea */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && (value.trim() || attachedFile)) onSend();
    }
  }

  return (
    <div className="border-t border-[var(--border-soft)] bg-[var(--surface-1)]/80 px-3 sm:px-4 py-3 sm:py-4">
      <div className="max-w-5xl mx-auto fade-in-up">

        {/* Image preview strip */}
        {attachedFile && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="relative group">
              {attachedFile.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={attachedFile.previewUrl}
                  alt={attachedFile.fileName}
                  className="h-16 rounded-xl border border-[var(--border-soft)] object-cover shadow-sm"
                />
              ) : (
                <div className="h-16 min-w-52 max-w-72 px-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-2)] flex items-center gap-2 shadow-sm">
                  <ImagePlus className="w-4 h-4 text-[var(--accent-2)] shrink-0" strokeWidth={2.2} />
                  <span className="text-xs text-[var(--text-2)] truncate">{attachedFile.fileName}</span>
                </div>
              )}
              <button
                onClick={() => onFileAttach(null)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[var(--surface-3)] text-[var(--text-1)] rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove file"
              >
                <X className="w-3 h-3" strokeWidth={2.5} />
              </button>
            </div>
            <span className="text-xs text-[var(--text-3)]">File attached: {attachedFile.fileName}</span>
          </div>
        )}

        <div
          className={`glass-panel flex gap-2 sm:gap-3 items-end border rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 transition-all ${
            disabled
              ? "opacity-75"
              : "focus-within:border-[var(--accent-1)]/45 focus-within:ring-4 focus-within:ring-[var(--ring-soft)] shadow-sm"
          }`}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Message Aura... (or paste a screenshot)"
            disabled={disabled}
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-[var(--text-1)] placeholder-[var(--text-3)] text-sm leading-relaxed max-h-40 disabled:opacity-50"
          />

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="*/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) processFile(file);
              e.target.value = "";
            }}
          />

          {/* Image attach button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            title="Attach file"
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all shrink-0 mb-0.5 ${
              attachedFile
                ? "bg-[var(--accent-soft)] text-[var(--accent-2)]"
                : "text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)]"
            } disabled:opacity-40`}
          >
            <ImagePlus className="w-4 h-4 icon-pop" strokeWidth={2.2} />
          </button>

          {/* Voice button */}
          <button
            onClick={toggleVoice}
            disabled={disabled}
            title={isListening ? "Stop recording" : "Voice input"}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all shrink-0 mb-0.5 ${
              isListening
                ? "bg-red-500 text-white animate-pulse shadow-md shadow-red-500/40"
                : "text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)]"
            } disabled:opacity-40`}
          >
            {isListening ? (
              <MicOff className="w-4 h-4" strokeWidth={2.2} />
            ) : (
              <Mic className="w-4 h-4 icon-pop" strokeWidth={2.2} />
            )}
          </button>

          {/* Send button */}
          <button
            onClick={() => {
              if (isListening) {
                recognitionRef.current?.stop();
              }
              onSend();
            }}
            disabled={disabled || (!value.trim() && !attachedFile)}
            className="w-8 h-8 bg-[var(--surface-1)] border border-[var(--accent-1)] hover:bg-[var(--accent-soft)] disabled:bg-[var(--surface-2)] text-[var(--accent-1)] disabled:text-[var(--text-3)] rounded-xl flex items-center justify-center transition-all shrink-0 mb-0.5 shadow-sm shadow-emerald-900/20 disabled:shadow-none"
            title="Send message"
          >
            <SendHorizontal className="w-4 h-4 translate-x-px" strokeWidth={2.4} />
          </button>
        </div>

        <p className="text-xs text-[var(--text-3)] text-center mt-2">
          <kbd className="font-sans">Enter</kbd> to send · <kbd className="font-sans">Shift+Enter</kbd> for new line · paste image or attach any file
        </p>
      </div>
    </div>
  );
}
