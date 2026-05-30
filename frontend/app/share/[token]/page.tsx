"use client";

import { use, useEffect, useState } from "react";
import { getSharedConversation, getSharedMessages } from "@/services/api";
import { Message } from "@/types";
import ChatMessage from "@/components/ChatMessage";
import { Bot, FileText, LoaderCircle, Sparkles } from "lucide-react";
import Link from "next/link";

interface SharedConversation {
  id: number;
  title: string;
}

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [conversation, setConversation] = useState<SharedConversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadShared() {
      try {
        const conv = await getSharedConversation(token);
        const msgs = await getSharedMessages(token);
        setConversation(conv);
        setMessages(msgs);
      } catch (err: any) {
        console.error(err);
        setError("This shared link does not exist, or has been revoked by the owner.");
      } finally {
        setLoading(false);
      }
    }
    loadShared();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-3 bg-[var(--surface-0)] text-[var(--text-3)] text-sm">
        <LoaderCircle className="w-8 h-8 animate-spin text-[var(--accent-1)]" strokeWidth={2.2} />
        <span className="font-medium tracking-wide animate-pulse">Loading shared chat...</span>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-[var(--surface-0)] text-center p-6">
        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 mb-2">
          <Bot className="w-8 h-8" strokeWidth={2.2} />
        </div>
        <h1 className="text-xl font-bold text-[var(--text-1)]">Link Not Found</h1>
        <p className="text-sm text-[var(--text-3)] max-w-sm">
          {error ?? "This shared link does not exist, or has been revoked by the owner."}
        </p>
        <Link
          href="/"
          className="mt-2 px-5 py-2.5 rounded-xl bg-[var(--accent-1)] hover:bg-[var(--accent-2)] text-white font-semibold text-sm transition-all shadow-md cursor-pointer"
        >
          Go to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="relative flex h-dvh flex-col bg-[var(--surface-0)] overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(10,143,111,0.08),transparent_32%),radial-gradient(circle_at_82%_100%,rgba(10,143,111,0.12),transparent_28%)]" />
      
      {/* Header */}
      <header className="print-hide glass-panel border-b border-[var(--border-soft)] px-4 sm:px-6 py-3.5 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 bg-gradient-to-br from-[var(--accent-1)] to-[var(--accent-2)] rounded-lg flex items-center justify-center shadow-md">
            <Bot className="w-4 h-4 text-white" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-semibold text-[var(--text-1)] truncate tracking-tight">
              {conversation.title}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-[var(--accent-1)] font-semibold bg-[var(--accent-soft)] px-2 py-0.25 rounded-full border border-[var(--accent-1)]/10">
                Shared Chat
              </span>
              <span className="text-[10px] text-[var(--text-3)]">Read-only transcript</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => window.print()}
            title="Export as PDF"
            className="px-3 py-1.5 rounded-lg border border-[var(--border-soft)] text-xs font-semibold text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" strokeWidth={2.2} />
            Export as PDF
          </button>
          <Link
            href="/"
            className="px-3.5 py-1.5 rounded-lg bg-[var(--accent-1)] hover:bg-[var(--accent-2)] text-white text-xs font-semibold transition-all shadow-sm active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" strokeWidth={2.2} />
            Start Chatting
          </Link>
        </div>
      </header>

      {/* Messages Scroll Container */}
      <div className="flex-1 overflow-y-auto z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6 fade-in-up">
          <div className="print-hide border-b border-[var(--border-soft)]/50 pb-6 mb-2 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--surface-1)] border border-[var(--border-soft)] flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-[var(--accent-1)]" strokeWidth={2.2} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-1)]">You are viewing a shared transcript</h2>
              <p className="text-xs text-[var(--text-3)] mt-0.5">This session was shared by a user. Try the Aura AI Chat Platform to start your own AI assistant conversation.</p>
            </div>
          </div>

          {messages.map((msg, i) => (
            <ChatMessage
              key={`shared-${i}`}
              message={msg}
              isStreaming={false}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
