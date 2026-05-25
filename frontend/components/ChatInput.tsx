"use client";

import { useRef, useEffect, useState, KeyboardEvent } from "react";

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

interface ChatInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSend: () => void;
  readonly disabled: boolean;
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
}: Readonly<ChatInputProps>) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);
  const baseTextRef = useRef(""); // text before voice started

  function toggleVoice() {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
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
    rec.continuous = true; // keep recording until mic button clicked again

    baseTextRef.current = value.trimEnd(); // save what's already typed
    recognitionRef.current = rec;
    setIsListening(true);

    rec.onresult = (e: { results: SpeechRecognitionResultList; resultIndex: number }) => {
      // Accumulate all results (finals + current interim) for live display
      let full = "";
      for (let i = 0; i < e.results.length; i++) {
        full += e.results[i][0].transcript;
      }
      const prefix = baseTextRef.current ? baseTextRef.current + " " : "";
      onChange(prefix + full.trim());
    };

    rec.onend = () => {
      setIsListening(false);
      // Re-focus textarea so send button click registers immediately
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
      if (!disabled && value.trim()) onSend();
    }
  }

  return (
    <div className="border-t border-gray-100 dark:border-white/[0.06] bg-white dark:bg-gray-900 px-4 py-4">
      <div className="max-w-4xl mx-auto">
        <div
          className={`flex gap-3 items-end bg-gray-50 dark:bg-gray-800/80 border rounded-2xl px-4 py-3 transition-all ${ 
            disabled
              ? "border-gray-100 dark:border-white/[0.04]"
              : "border-gray-200 dark:border-white/[0.08] focus-within:border-blue-400 dark:focus-within:border-blue-500/50 focus-within:ring-4 focus-within:ring-blue-500/10 dark:focus-within:ring-blue-500/10 shadow-sm"
          }`}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message AI Chat…  (Shift+Enter for new line)"
            disabled={disabled}
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm leading-relaxed max-h-40 disabled:opacity-50"
          />

          <button
            onClick={toggleVoice}
            disabled={disabled}
            title={isListening ? "Stop recording" : "Voice input"}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all shrink-0 mb-0.5 ${
              isListening
                ? "bg-red-500 text-white animate-pulse shadow-md shadow-red-500/40"
                : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/[0.08]"
            } disabled:opacity-40`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" />
              <path d="M5.5 9.643a.75.75 0 00-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-1.5v-1.546A6.001 6.001 0 0016 10v-.357a.75.75 0 00-1.5 0V10a4.5 4.5 0 01-9 0v-.357z" />
            </svg>
          </button>

          <button
            onClick={() => { if (isListening) recognitionRef.current?.stop(); onSend(); }}
            disabled={disabled || !value.trim()}
            className="w-8 h-8 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-200 dark:disabled:bg-gray-700 text-white disabled:text-gray-400 rounded-xl flex items-center justify-center transition-all shrink-0 mb-0.5 shadow-sm shadow-blue-500/30 disabled:shadow-none"
            title="Send message"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4 -rotate-45 translate-x-px"
            >
              <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
            </svg>
          </button>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-600 text-center mt-2">
          <kbd className="font-sans">Enter</kbd> to send · <kbd className="font-sans">Shift+Enter</kbd> for new line · mic for voice
        </p>
      </div>
    </div>
  );
}
