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
} from "@/services/api";
import { Conversation, Message } from "@/types";
import Sidebar from "@/components/Sidebar";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import { useTheme } from "@/lib/ThemeContext";

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [systemPromptOpen, setSystemPromptOpen] = useState(false);
  const [systemPromptDraft, setSystemPromptDraft] = useState("");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const { theme, toggle } = useTheme();

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  /* Close export menu when clicking outside */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
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
    async function init() {
      try {
        const convs = await getConversations();
        setConversations(convs);

        if (convs.length > 0) {
          await loadConversation(convs[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) {
        const remaining = conversations.filter((c) => c.id !== id);
        if (remaining.length > 0) {
          await loadConversation(remaining[0].id);
        } else {
          setActiveId(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

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

  async function handleSend() {
    if (!activeId || !input.trim() || isStreaming) return;
    userScrolledUp.current = false;
    const text = input.trim();
    setInput("");
    await doSend(text);
  }

  async function doSend(text: string) {
    if (!activeId || isStreaming) return;
    userScrolledUp.current = false;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    setIsStreaming(true);

    let accumulated = "";

    try {
      await sendMessage(text, activeId, (chunk) => {
        accumulated += chunk;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: accumulated,
          };
          return updated;
        });
      });
      // Refresh sidebar to pick up auto-generated title (first exchange)
      const refreshed = await getConversations();
      setConversations(refreshed);
    } catch (err) {
      console.error(err);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Something went wrong. Please try again.",
        };
        return updated;
      });
    } finally {
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
      lines.push(msg.role === "user" ? "**You**" : "**Assistant**");
      lines.push("");
      lines.push(msg.content);
      lines.push("");
      lines.push("---");
      lines.push("");
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

  const isEmpty = messages.length === 0 && !isLoadingMessages;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={loadConversation}
        onNewChat={handleNewChat}
        onRename={handleRename}
        onDelete={handleDelete}
        isCreating={isCreating}
      />

      {/* Main chat area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-white/[0.06] px-6 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-base font-semibold text-gray-900 dark:text-white truncate">
              {activeId
                ? conversations.find((c) => c.id === activeId)?.title ?? "Chat"
                : "AI Chat"}
            </h1>
          </div>

          {isStreaming && (
            <span className="flex items-center gap-1.5 text-xs text-blue-500 font-medium bg-blue-50 dark:bg-blue-950/50 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
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
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
                    <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
                  </svg>
                </button>
                {exportMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1">
                    <button
                      onClick={exportAsMarkdown}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 opacity-60">
                        <path d="M0 3.75C0 2.784.784 2 1.75 2h12.5C15.216 2 16 2.784 16 3.75v8.5A1.75 1.75 0 0 1 14.25 14H1.75A1.75 1.75 0 0 1 0 12.25Zm1.75-.25a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25v-8.5a.25.25 0 0 0-.25-.25ZM5 10.25V7.182l1.22 1.22a.75.75 0 0 0 1.06-1.06L5.53 5.591a.75.75 0 0 0-1.06 0L2.72 7.341a.75.75 0 0 0 1.06 1.06L5 7.182v3.068a.75.75 0 0 0 1.5 0Zm5.5-1.25a.75.75 0 0 0 0 1.5h1.75a.75.75 0 0 0 0-1.5Zm-2.5-2a.75.75 0 0 0 0 1.5h4.25a.75.75 0 0 0 0-1.5Zm0-2a.75.75 0 0 0 0 1.5h4.25a.75.75 0 0 0 0-1.5Z" />
                      </svg>
                      Export as Markdown
                    </button>
                    <button
                      onClick={exportAsJSON}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 opacity-60">
                        <path d="M2.75 2A1.75 1.75 0 0 0 1 3.75v8.5C1 13.216 1.784 14 2.75 14h10.5A1.75 1.75 0 0 0 15 12.25v-8.5A1.75 1.75 0 0 0 13.25 2ZM2.5 3.75a.25.25 0 0 1 .25-.25h10.5a.25.25 0 0 1 .25.25v8.5a.25.25 0 0 1-.25.25H2.75a.25.25 0 0 1-.25-.25ZM5.22 6.03a.75.75 0 0 1 1.06-1.06l1 1a.75.75 0 0 1 0 1.06l-1 1a.75.75 0 0 1-1.06-1.06l.47-.47-.47-.47Zm4.5-1.06a.75.75 0 0 1 1.06 1.06l-.47.47.47.47a.75.75 0 1 1-1.06 1.06l-1-1a.75.75 0 0 1 0-1.06l1-1Z" />
                      </svg>
                      Export as JSON
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Theme toggle */}
            <button
              onClick={toggle}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.06l1.06-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.06 1.06a.75.75 0 001.06 1.06l1.06-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.061zM5.404 6.464a.75.75 0 001.06-1.06L5.403 4.343a.75.75 0 00-1.06 1.06l1.061 1.061z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          </div>
        </header>

        {/* System Prompt Panel */}
        {activeId && (
          <div className="border-b border-gray-100 dark:border-white/[0.06] bg-white dark:bg-gray-900 shrink-0">
            <button
              onClick={() => setSystemPromptOpen((v) => !v)}
              className="w-full flex items-center gap-2 px-6 py-2 text-xs text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
            >
              {/* Gear icon */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
                <path fillRule="evenodd" d="M6.955 1.45A.75.75 0 0 1 7.68 1h.642a.75.75 0 0 1 .725.55l.189.694c.1.372.382.65.75.752l.388.108a.75.75 0 0 1 .468.98l-.27.678a.726.726 0 0 0 .176.845l.495.416a.75.75 0 0 1 .067 1.074l-.443.494a.726.726 0 0 0-.072.862l.303.641a.75.75 0 0 1-.414.998l-.683.232a.726.726 0 0 0-.513.648l-.03.713A.75.75 0 0 1 8.32 12h-.642a.75.75 0 0 1-.748-.703l-.03-.713a.726.726 0 0 0-.513-.648l-.683-.232a.75.75 0 0 1-.414-.998l.303-.64a.726.726 0 0 0-.072-.863l-.443-.494A.75.75 0 0 1 4.146 6.64l.495-.416a.726.726 0 0 0 .176-.845l-.27-.678a.75.75 0 0 1 .468-.98l.388-.108a.726.726 0 0 0 .75-.752l.189-.694ZM8 7a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">System Prompt</span>
              {conversations.find((c) => c.id === activeId)?.system_prompt ? (
                <span className="text-gray-400 dark:text-gray-500 truncate max-w-xs">
                  {conversations.find((c) => c.id === activeId)!.system_prompt}
                </span>
              ) : (
                <span className="text-gray-400 dark:text-gray-600 italic">default</span>
              )}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                className={`w-3 h-3 ml-auto transition-transform ${systemPromptOpen ? "rotate-180" : ""}`}
              >
                <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
            </button>

            {systemPromptOpen && (
              <div className="px-6 pb-4 pt-1">
                <textarea
                  value={systemPromptDraft}
                  onChange={(e) => setSystemPromptDraft(e.target.value)}
                  placeholder="e.g. You are an expert Python developer who explains code clearly and concisely."
                  rows={3}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={() => {
                      const conv = conversations.find((c) => c.id === activeId);
                      setSystemPromptDraft(conv?.system_prompt ?? "");
                      setSystemPromptOpen(false);
                    }}
                    className="px-3 py-1.5 text-xs rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSystemPrompt}
                    className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950"
        >
          {renderContent()}
        </div>

        {/* Input */}
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          disabled={isStreaming || !activeId}
        />
      </div>
    </div>
  );

  function renderContent() {
    if (isEmpty) {
      const suggestions = [
        { icon: "💡", label: "Explain a concept", prompt: "Explain how neural networks work in simple terms" },
        { icon: "✍️", label: "Write something", prompt: "Write a short professional bio for a software engineer" },
        { icon: "🐛", label: "Debug code", prompt: "Help me debug this error: " },
        { icon: "📊", label: "Analyse data", prompt: "What's the best way to visualise time-series data?" },
      ];

      return (
        <div className="h-full flex flex-col items-center justify-center gap-8 px-6 pb-12">
          {/* Logo + greeting */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/20 rounded-3xl blur-xl" />
              <div className="relative w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/30">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white">
                  <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                How can I help you today?
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1.5 max-w-xs">
                Ask me anything — I remember the full conversation.
              </p>
            </div>
          </div>

          {/* Suggestion chips */}
          {activeId && (
            <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  onClick={() => { setInput(s.prompt); }}
                  className="flex flex-col gap-1.5 p-4 rounded-2xl border border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-800/60 hover:border-blue-400 dark:hover:border-blue-500/50 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all text-left group shadow-sm hover:shadow-md"
                >
                  <span className="text-xl">{s.icon}</span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">{s.label}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 line-clamp-1">{s.prompt}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (isLoadingMessages) {
      return (
        <div className="flex items-center justify-center h-full gap-2 text-gray-400 dark:text-gray-500 text-sm">
          <svg
            className="w-4 h-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
          Loading messages…
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
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