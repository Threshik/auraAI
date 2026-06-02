"use client";

import { useEffect, useRef, useState } from "react";
import {
  getMessages,
  sendMessage,
  getConversations,
  createConversation,
  renameConversation,
  deleteConversation,
  setSystemPrompt,
  deleteMessagesFrom,
  shareConversation,
  unshareConversation,
} from "@/services/api";
import { Conversation, Message } from "@/types";
import Sidebar from "@/components/Sidebar";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import type { AttachedFile } from "@/components/ChatInput";
import {
  Bot,
  ChevronDown,
  Download,
  FileCode2,
  FileJson2,
  FileText,
  LoaderCircle,
  MoonStar,
  Settings2,
  Sparkles,
  SunMedium,
  PanelLeftClose,
  PanelLeftOpen,
  Share2,
  Check,
  Copy,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "@/lib/ThemeContext";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import LoginPage from "@/components/LoginPage";

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slugify(s: string) {
  return s.replace(/[^a-z0-9]/gi, "-").replace(/-+/g, "-").toLowerCase().slice(0, 60);
}

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [systemPromptOpen, setSystemPromptOpen] = useState(false);
  const [systemPromptDraft, setSystemPromptDraft] = useState("");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSharingLoading, setIsSharingLoading] = useState(false);
  const [origin, setOrigin] = useState("");
  const { theme, toggle } = useTheme();
  const { isAuthenticated, isLoading, login } = useAuth();

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  async function handleNewChat() {
    setIsCreating(true);
    try {
      const conv = await createConversation();
      setConversations((prev) => [conv, ...prev]);
      setActiveId(conv.id);
      setMessages([]);
      setSystemPromptDraft("");
      setSystemPromptOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  }

  // Typewriter drip — buffer chunks from the stream, reveal gradually
  const streamBufferRef = useRef<string>("");
  const typingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingDisplayRef = useRef<string>("");
  const streamDoneRef = useRef<boolean>(false);


  /* Close export & share menus when clicking outside */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) {
        setShareMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* Auto-scroll only when the user hasn't scrolled up */
  useEffect(() => {
    if (!userScrolledUp.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  function handleScroll() {
    const el = scrollContainerRef.current;
    if (!el) return;
    // Consider "at bottom" if within 80px of the bottom
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    userScrolledUp.current = distFromBottom > 80;
  }

  /* Sync system-prompt draft when switching conversations */
  useEffect(() => {
    const conv = conversations.find((c) => c.id === activeId);
    setSystemPromptDraft(conv?.system_prompt ?? "");
    setSystemPromptOpen(false);
  }, [activeId, conversations]);

  /* Bootstrap: load existing conversations or create one */
  useEffect(() => {
    if (!isAuthenticated) return;
    async function init() {
      try {
        const convs = await getConversations();
        setConversations(convs);

        if (convs.length > 0) {
          await loadConversation(convs[0].id);
        } else {
          await handleNewChat();
        }
      } catch (err) {
        console.error(err);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-3 bg-[var(--surface-0)] text-[var(--text-3)] text-sm">
        <LoaderCircle className="w-8 h-8 animate-spin text-[var(--accent-1)]" strokeWidth={2.2} />
        <span className="font-medium tracking-wide animate-pulse">Initializing Security Session...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={login} />;
  }


  async function loadConversation(id: number) {
    userScrolledUp.current = false;
    setActiveId(id);
    setMessages([]);
    setIsLoadingMessages(true);
    try {
      const msgs = await getMessages(id);
      setMessages(msgs);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingMessages(false);
    }
  }

  async function handleRename(id: number, title: string) {
    try {
      const updated = await renameConversation(id, title);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? updated : c))
      );
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteConversation(id);
      const remaining = conversations.filter((c) => c.id !== id);
      setConversations(remaining);
      if (activeId === id) {
        if (remaining.length > 0) {
          await loadConversation(remaining[0].id);
        } else {
          await handleNewChat();
        }
      }
    } catch (err) {
      console.error(err);
    }
  }



  async function handleSaveSystemPrompt() {
    if (!activeId) return;
    try {
      const updated = await setSystemPrompt(activeId, systemPromptDraft);
      setConversations((prev) =>
        prev.map((c) => (c.id === activeId ? { ...c, system_prompt: updated.system_prompt } : c))
      );
      setSystemPromptOpen(false);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleToggleShare() {
    if (!activeId) return;
    const activeConv = conversations.find((c) => c.id === activeId);
    if (!activeConv) return;

    setIsSharingLoading(true);
    try {
      if (activeConv.is_shared) {
        await unshareConversation(activeId);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeId ? { ...c, is_shared: false, share_token: null } : c
          )
        );
      } else {
        const res = await shareConversation(activeId);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeId ? { ...c, is_shared: true, share_token: res.share_token } : c
          )
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSharingLoading(false);
    }
  }

  async function handleSend() {
    if ((!input.trim() && !attachedFile) || isStreaming) return;
    userScrolledUp.current = false;
    const text = input.trim();
    const file = attachedFile;
    setInput("");
    setAttachedFile(null);

    let conversationId = activeId;
    if (!conversationId) {
      try {
        const conv = await createConversation();
        setConversations((prev) => [conv, ...prev]);
        setActiveId(conv.id);
        conversationId = conv.id;
      } catch (err) {
        console.error("Failed to create conversation before sending", err);
        return;
      }
    }

    await doSend(text, file, conversationId);
  }

  async function doSend(text: string, file?: AttachedFile | null, conversationIdOverride?: number) {
    const conversationId = conversationIdOverride ?? activeId;
    if (!conversationId || isStreaming) return;
    userScrolledUp.current = false;

    // Reset typewriter state
    streamBufferRef.current = "";
    typingDisplayRef.current = "";
    streamDoneRef.current = false;

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: text,
        file_name: file?.fileName ?? null,
        file_media_type: file?.mediaType ?? null,
        file_base64: file?.base64 ?? null,
      },
    ]);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    setIsStreaming(true);

    // Reveal ~5 chars every 10 ms ≈ 500 chars/sec — smooth typing feel
    typingTimerRef.current = setInterval(() => {
      if (streamBufferRef.current.length === 0) {
        if (streamDoneRef.current) {
          clearInterval(typingTimerRef.current!);
          typingTimerRef.current = null;
          setIsStreaming(false);
        }
        return;
      }
      const reveal = streamBufferRef.current.slice(0, 5);
      streamBufferRef.current = streamBufferRef.current.slice(5);
      typingDisplayRef.current += reveal;
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: typingDisplayRef.current };
        return updated;
      });
    }, 10);

    try {
      await sendMessage(text, conversationId, (chunk) => {
        streamBufferRef.current += chunk; // buffer only — typewriter reveals it
      }, file?.base64, file?.mediaType, file?.fileName);
      // Stream finished — let the typewriter drain the buffer then stop
      streamDoneRef.current = true;
      // Refresh sidebar to pick up auto-generated title
      const refreshed = await getConversations();
      setConversations(refreshed);
    } catch (err) {
      console.error(err);
      // Stop typewriter and show error immediately
      if (typingTimerRef.current) {
        clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Something went wrong. Please try again.",
        };
        return updated;
      });
      setIsStreaming(false);
    }
  }

  async function handleEdit(msgIndex: number, newContent: string) {
    if (!activeId || isStreaming) return;
    const target = messages[msgIndex];
    if (!target?.id) return;
    try {
      await deleteMessagesFrom(activeId, target.id);
      setMessages(messages.slice(0, msgIndex));
      await doSend(newContent);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleRegenerate() {
    if (!activeId || isStreaming) return;
    // Find the last user message
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") { lastUserIdx = i; break; }
    }
    if (lastUserIdx === -1) return;
    const lastUser = messages[lastUserIdx];
    if (!lastUser.id) return;
    try {
      await deleteMessagesFrom(activeId, lastUser.id);
      setMessages(messages.slice(0, lastUserIdx));
      await doSend(lastUser.content);
    } catch (err) {
      console.error(err);
    }
  }

  function exportAsMarkdown() {
    const conv = conversations.find((c) => c.id === activeId);
    const title = conv?.title ?? "Chat";
    const lines = [`# ${title}`, `> Exported on ${new Date().toLocaleString()}`, ""];
    for (const msg of messages) {
      lines.push(msg.role === "user" ? "**You**" : "**Assistant**", "", msg.content, "", "---", "");
    }
    downloadBlob(lines.join("\n"), `${slugify(title)}.md`, "text/markdown");
    setExportMenuOpen(false);
  }

  function exportAsJSON() {
    const conv = conversations.find((c) => c.id === activeId);
    const title = conv?.title ?? "Chat";
    const data = {
      title,
      exported_at: new Date().toISOString(),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    };
    downloadBlob(JSON.stringify(data, null, 2), `${slugify(title)}.json`, "application/json");
    setExportMenuOpen(false);
  }

  const isEmpty = messages.length === 0 && !isLoadingMessages;

  return (
    <div className="relative flex h-dvh overflow-hidden bg-[var(--surface-0)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(10,143,111,0.08),transparent_32%),radial-gradient(circle_at_82%_100%,rgba(10,143,111,0.12),transparent_28%)]" />
      {/* Sidebar */}
      <div className={`print-hide transition-[width] duration-300 ease-in-out shrink-0 overflow-hidden ${sidebarOpen ? "w-[320px]" : "w-0 sm:w-[60px]"}`}>
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={loadConversation}
          onNewChat={handleNewChat}
          onRename={handleRename}
          onDelete={handleDelete}
          isCreating={isCreating}
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
        />
      </div>

      {/* Main chat area */}
      <div className="relative z-10 flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="print-hide relative z-20 glass-panel border-b border-[var(--border-soft)] px-4 sm:px-6 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="sm:hidden w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
              title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="w-4 h-4 icon-pop" strokeWidth={2.2} />
              ) : (
                <PanelLeftOpen className="w-4 h-4 icon-pop" strokeWidth={2.2} />
              )}
            </button>
            <h1 className="text-base sm:text-lg font-semibold text-[var(--text-1)] tracking-tight truncate">
              {activeId
                ? conversations.find((c) => c.id === activeId)?.title ?? "Chat"
                : "AI Chat"}
            </h1>
          </div>

          {isStreaming && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-[var(--accent-2)] font-medium bg-[var(--accent-soft)] px-2.5 py-1 rounded-full border border-[var(--accent-1)]/20">
              <span className="w-1.5 h-1.5 bg-[var(--accent-1)] rounded-full animate-pulse" />{" "}
              Thinking…
            </span>
          )}

          <div className="flex items-center gap-1">
            {/* Export button */}
            {activeId && messages.length > 0 && (
              <div className="relative" ref={exportMenuRef}>
                <button
                  onClick={() => setExportMenuOpen((v) => !v)}
                  title="Export chat"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  <Download className="w-4 h-4 icon-pop" strokeWidth={2.2} />
                </button>
                {exportMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--surface-1)] border border-[var(--border-soft)] rounded-lg shadow-2xl z-50 py-1">
                    <button
                      onClick={exportAsMarkdown}
                      className="w-full text-left px-3 py-2 text-sm text-[var(--text-2)] hover:bg-[var(--surface-2)] flex items-center gap-2 cursor-pointer"
                    >
                      <FileCode2 className="w-3.5 h-3.5 opacity-70" strokeWidth={2.2} />
                      Export as Markdown
                    </button>
                    <button
                      onClick={exportAsJSON}
                      className="w-full text-left px-3 py-2 text-sm text-[var(--text-2)] hover:bg-[var(--surface-2)] flex items-center gap-2 cursor-pointer"
                    >
                      <FileJson2 className="w-3.5 h-3.5 opacity-70" strokeWidth={2.2} />
                      Export as JSON
                    </button>
                    <button
                      onClick={() => {
                        window.print();
                        setExportMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-[var(--text-2)] hover:bg-[var(--surface-2)] flex items-center gap-2 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 opacity-70" strokeWidth={2.2} />
                      Export as PDF
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Share button */}
            {activeId && messages.length > 0 && (
              <div className="relative" ref={shareMenuRef}>
                <button
                  onClick={() => {
                    setShareMenuOpen((v) => !v);
                    setCopiedLink(false);
                  }}
                  title="Share chat"
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    conversations.find((c) => c.id === activeId)?.is_shared
                      ? "text-[var(--accent-1)] bg-[var(--accent-soft)] hover:bg-[var(--accent-soft)]/80"
                      : "text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)]"
                  }`}
                >
                  <Share2 className="w-4 h-4 icon-pop" strokeWidth={2.2} />
                </button>
                {shareMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-72 bg-[var(--surface-1)] border border-[var(--border-soft)] rounded-xl shadow-2xl z-50 p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[var(--text-1)]">Share Chat</span>
                      <span className="text-[10px] text-[var(--text-3)] italic">Public link</span>
                    </div>
                    
                    <hr className="border-[var(--border-soft)]" />

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs text-[var(--text-2)] font-medium">Publicly accessible</span>
                      <button
                        onClick={handleToggleShare}
                        disabled={isSharingLoading}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          conversations.find((c) => c.id === activeId)?.is_shared
                            ? "bg-[var(--accent-1)]"
                            : "bg-[var(--surface-3)]"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            conversations.find((c) => c.id === activeId)?.is_shared
                              ? "translate-x-4"
                              : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {conversations.find((c) => c.id === activeId)?.is_shared && (
                      <div className="flex flex-col gap-2 mt-1 fade-in-up">
                        <p className="text-[10px] text-[var(--text-3)]">Anyone with this link can read this conversation:</p>
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            readOnly
                            value={`${origin}/share/${conversations.find((c) => c.id === activeId)?.share_token}`}
                            className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-2)] text-[var(--text-1)] select-all focus:outline-none"
                          />
                          <button
                            onClick={() => {
                              const shareToken = conversations.find((c) => c.id === activeId)?.share_token;
                              if (shareToken) {
                                navigator.clipboard.writeText(`${origin}/share/${shareToken}`);
                                setCopiedLink(true);
                                setTimeout(() => setCopiedLink(false), 2000);
                              }
                            }}
                            className="p-1.5 rounded-lg bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors border border-[var(--border-soft)]"
                            title="Copy link"
                          >
                            {copiedLink ? (
                              <Check className="w-3.5 h-3.5 text-green-500" strokeWidth={2.4} />
                            ) : (
                              <Copy className="w-3.5 h-3.5" strokeWidth={2.2} />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}



            {/* Theme toggle */}
            <button
              onClick={toggle}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? (
                <SunMedium className="w-4 h-4 icon-spin-on-hover" strokeWidth={2.2} />
              ) : (
                <MoonStar className="w-4 h-4 icon-spin-on-hover" strokeWidth={2.2} />
              )}
            </button>
          </div>
        </header>

        {/* Messages */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto"
        >
          {renderContent()}
        </div>

        {/* System Prompt Panel */}
        {activeId && (
          <div className="print-hide px-3 sm:px-4 pt-2">
            <div className="flex flex-col bg-transparent">
              <div className="flex items-center">
                <button
                  onClick={() => setSystemPromptOpen((v) => !v)}
                  className="flex items-center gap-1.5 py-1 text-xs text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors cursor-pointer group"
                >
                  <Settings2 className="w-3.5 h-3.5 text-[var(--accent-1)] group-hover:rotate-45 transition-transform duration-300 shrink-0" strokeWidth={2.2} />
                  <span className="font-semibold text-[var(--text-1)]">System Instructions</span>
                  
                  {/* Status indicator badge */}
                  {conversations.find((c) => c.id === activeId)?.system_prompt ? (
                    <span className="text-[10px] text-[var(--accent-1)] font-semibold flex items-center gap-1 bg-[var(--accent-soft)] px-2 py-0.5 rounded-full border border-[var(--accent-1)]/10">
                      <span className="w-1 h-1 rounded-full bg-[var(--accent-1)] animate-pulse" />
                      Customized
                    </span>
                  ) : (
                    <span className="text-[10px] text-[var(--text-3)] italic">
                      Default Behavior
                    </span>
                  )
                  }
                  <ChevronDown className={`w-3 h-3 text-[var(--text-3)] group-hover:text-[var(--text-1)] transition-transform duration-300 ${systemPromptOpen ? "rotate-180" : ""}`} strokeWidth={2.5} />
                </button>
              </div>

              {systemPromptOpen && (
                <div className="mt-2 p-3 rounded-xl border border-[var(--border-soft)]/60 bg-[var(--surface-1)]/60 backdrop-blur-md fade-in-up shadow-sm">
                  <p className="text-[10px] text-[var(--text-3)] mb-2">
                    Define custom rules, behavior guidelines, or persona instructions for Aura AI to follow in this conversation.
                  </p>
                  
                  <textarea
                    value={systemPromptDraft}
                    onChange={(e) => setSystemPromptDraft(e.target.value)}
                    placeholder="e.g. You are a senior frontend engineer. Explain React concepts with concise TypeScript code examples."
                    rows={3}
                    className="w-full text-sm px-3.5 py-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-1)]/80 text-[var(--text-1)] placeholder-[var(--text-3)] resize-none focus:outline-none focus:border-[var(--accent-1)]/55 focus:ring-2 focus:ring-[var(--ring-soft)] transition-all leading-relaxed"
                  />
                  
                  <div className="flex justify-between items-center mt-2.5">
                    {/* Clear Button */}
                    {conversations.find((c) => c.id === activeId)?.system_prompt ? (
                      <button
                        onClick={async () => {
                          setSystemPromptDraft("");
                          if (!activeId) return;
                          try {
                            const updated = await setSystemPrompt(activeId, "");
                            setConversations((prev) =>
                              prev.map((c) => (c.id === activeId ? { ...c, system_prompt: updated.system_prompt } : c))
                            );
                            setSystemPromptOpen(false);
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className="text-xs text-red-500 hover:text-red-600 font-medium px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                      >
                        Reset to default
                      </button>
                    ) : (
                      <div />
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const conv = conversations.find((c) => c.id === activeId);
                          setSystemPromptDraft(conv?.system_prompt ?? "");
                          setSystemPromptOpen(false);
                        }}
                        className="px-3.5 py-1.5 text-xs rounded-lg text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-all cursor-pointer font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveSystemPrompt}
                        className="px-4 py-1.5 text-xs rounded-lg bg-[var(--accent-1)] hover:bg-[var(--accent-2)] text-white font-semibold transition-all shadow-sm active:scale-[0.98] cursor-pointer"
                      >
                        Save Instructions
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="print-hide">
          <ChatInput
            value={input}
            onChange={setInput}
            onSend={handleSend}
            disabled={isStreaming}
            attachedFile={attachedFile}
            onFileAttach={setAttachedFile}
          />
        </div>
      </div>
    </div>
  );

  function renderContent() {
    if (isEmpty) {
      const suggestions: { icon: LucideIcon; label: string; prompt: string }[] = [
        { icon: Sparkles, label: "Explain a concept", prompt: "Explain how neural networks work in simple terms" },
        { icon: FileCode2, label: "Write something", prompt: "Write a short professional bio for a software engineer" },
        { icon: Settings2, label: "Debug code", prompt: "Help me debug this error: " },
        { icon: Download, label: "Analyse data", prompt: "What's the best way to visualise time-series data?" },
      ];

      return (
        <div className="h-full flex flex-col items-center justify-center pt-8 sm:pt-10 gap-6 px-4 sm:px-6 pb-8">
          {/* Logo + greeting */}
          <div className="flex flex-col items-center gap-4 fade-in-up">
            <div className="relative">
              <div className="absolute inset-0 bg-[var(--accent-1)]/20 rounded-3xl blur-xl" />
              <div className="orbital-ring glow-pulse relative w-16 h-16 bg-gradient-to-br from-[var(--accent-1)] to-[var(--accent-2)] rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-900/25">
                <Bot className="w-8 h-8 text-white" strokeWidth={2.2} />
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-1)] tracking-tight">
                How can I help you today?
              </h2>
              <p className="text-[var(--text-2)] text-sm mt-1.5 max-w-xs sm:max-w-md">
                Ask me anything — I remember the full conversation.
              </p>
            </div>
          </div>

          {/* Suggestion chips */}
          {activeId && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl stagger-children">
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  onClick={() => { setInput(s.prompt); }}
                  className="flex flex-col gap-1.5 p-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-1)]/90 hover:border-[var(--accent-1)]/40 hover:bg-[var(--surface-2)]/75 transition-all text-left group shadow-sm hover:shadow-lg hover:shadow-emerald-900/10 lift-on-hover"
                >
                  <span className="w-9 h-9 rounded-xl bg-[var(--surface-2)] text-[var(--accent-2)] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <s.icon className="w-4.5 h-4.5" strokeWidth={2.2} />
                  </span>
                  <span className="text-sm font-medium text-[var(--text-1)] group-hover:text-[var(--accent-2)] transition-colors">{s.label}</span>
                  <span className="text-xs text-[var(--text-3)] line-clamp-1">{s.prompt}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (isLoadingMessages) {
      return (
        <div className="flex items-center justify-center h-full gap-2 text-[var(--text-3)] text-sm">
          <LoaderCircle className="w-4 h-4 animate-spin" strokeWidth={2.2} />
          Loading messages…
        </div>
      );
    }

    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6 fade-in-up">
        {messages.map((msg, i) => {
          const isLastMsg = i === messages.length - 1;
          return (
            <ChatMessage
              key={`${activeId}-${i}`}
              message={msg}
              isStreaming={isStreaming && isLastMsg}
              onEdit={msg.role === "user" && !isStreaming ? (newContent) => handleEdit(i, newContent) : undefined}
              onRegenerate={msg.role === "assistant" && isLastMsg && !isStreaming ? handleRegenerate : undefined}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>
    );
  }
}