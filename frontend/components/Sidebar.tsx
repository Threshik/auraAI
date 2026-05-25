"use client";

import { useRef, useState } from "react";
import { Conversation } from "@/types";

interface SidebarProps {
  conversations: Conversation[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onNewChat: () => void;
  onRename: (id: number, title: string) => void;
  onDelete: (id: number) => void;
  isCreating: boolean;
}

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onRename,
  onDelete,
  isCreating,
}: Readonly<SidebarProps>) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function startRename(conv: Conversation, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditValue(conv.title);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commitRename(id: number) {
    const trimmed = editValue.trim();
    if (trimmed) onRename(id, trimmed);
    setEditingId(null);
  }

  function handleRenameKey(e: React.KeyboardEvent, id: number) {
    if (e.key === "Enter") commitRename(id);
    if (e.key === "Escape") setEditingId(null);
  }

  const filtered = search.trim()
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(search.trim().toLowerCase())
      )
    : conversations;

  return (
    <aside className="w-64 bg-[#0f1117] flex flex-col h-full shrink-0 border-r border-white/[0.06]">
      {/* Brand */}
      <div className="px-4 pt-5 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0 shadow-lg shadow-blue-900/40">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white">
              <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <span className="text-white font-semibold text-sm tracking-tight">AI Chat</span>
            <p className="text-[10px] text-gray-500 leading-none mt-0.5">Powered by GPT-4o</p>
          </div>
        </div>

        <button
          onClick={onNewChat}
          disabled={isCreating}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-medium transition-all shadow-lg shadow-blue-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
          </svg>
          {isCreating ? "Creating..." : "New chat"}
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2.5">
        <div className="relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none"
          >
            <path
              fillRule="evenodd"
              d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats…"
            className="w-full bg-white/[0.04] text-gray-300 text-xs placeholder-gray-600 rounded-lg pl-7 pr-7 py-2 outline-none focus:bg-white/[0.07] border border-transparent focus:border-blue-500/30 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5 scrollbar-thin">
        {filtered.length === 0 ? (
          <p className="text-gray-600 text-xs px-3 py-3 text-center">
            {search ? "No matching chats" : "No conversations yet"}
          </p>
        ) : (
          filtered.map((conv) => (
            <div
              key={conv.id}
              className={`group relative flex items-center rounded-xl transition-all ${
                conv.id === activeId
                  ? "bg-white/[0.07] border-l-2 border-blue-500 pl-0"
                  : "hover:bg-white/[0.04] border-l-2 border-transparent"
              }`}
            >
              {editingId === conv.id ? (
                <input
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => commitRename(conv.id)}
                  onKeyDown={(e) => handleRenameKey(e, conv.id)}
                  className="flex-1 bg-transparent text-white text-sm px-3 py-2.5 outline-none min-w-0"
                />
              ) : (
                <button
                  onClick={() => onSelect(conv.id)}
                  onDoubleClick={(e) => startRename(conv, e)}
                  className={`flex-1 text-left pl-3 pr-1 py-2.5 text-sm flex items-center gap-2.5 min-w-0 ${
                    conv.id === activeId ? "text-white" : "text-gray-400 group-hover:text-gray-200"
                  }`}
                >
                  {/* Letter avatar */}
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors ${
                    conv.id === activeId
                      ? "bg-blue-600 text-white"
                      : "bg-white/[0.06] text-gray-400 group-hover:bg-white/[0.1] group-hover:text-gray-200"
                  }`}>
                    {conv.title.charAt(0).toUpperCase()}
                  </span>
                  <span className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span className="truncate font-medium text-[13px]">{conv.title}</span>
                    {conv.updated_at && (
                      <span className="text-[10px] text-gray-600 group-hover:text-gray-500 truncate">
                        {formatRelative(conv.updated_at)}
                      </span>
                    )}
                  </span>
                </button>
              )}

              {/* Action buttons — visible on hover */}
              {editingId !== conv.id && (
                <div className="flex items-center pr-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={(e) => startRename(conv, e)}
                    title="Rename"
                    className="w-6 h-6 flex items-center justify-center rounded-md text-gray-600 hover:text-gray-200 hover:bg-white/[0.1] transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                      <path d="M13.488 2.513a1.75 1.75 0 00-2.475 0L6.75 6.774a2.75 2.75 0 00-.596.892l-.848 2.047a.75.75 0 00.98.98l2.047-.848a2.75 2.75 0 00.892-.596l4.261-4.263a1.75 1.75 0 000-2.474zM4.75 14.25h-2a.75.75 0 010-1.5h2a.75.75 0 010 1.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                    title="Delete"
                    className="w-6 h-6 flex items-center justify-center rounded-md text-gray-600 hover:text-red-400 hover:bg-white/[0.1] transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                      <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 000 1.5h.3l.815 8.15A1.5 1.5 0 005.357 15h5.285a1.5 1.5 0 001.493-1.35l.815-8.15h.3a.75.75 0 000-1.5H11v-.75A2.25 2.25 0 008.75 1h-1.5A2.25 2.25 0 005 3.25zm2.25-.75a.75.75 0 00-.75.75V4h3v-.75a.75.75 0 00-.75-.75h-1.5zM6.05 6a.75.75 0 01.787.713l.275 5.5a.75.75 0 01-1.498.075l-.275-5.5A.75.75 0 016.05 6zm3.9 0a.75.75 0 01.712.787l-.275 5.5a.75.75 0 01-1.498-.075l.275-5.5a.75.75 0 01.786-.712z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

function formatRelative(iso: string): string {
  // Backend returns naive UTC datetimes without a timezone suffix.
  // Appending 'Z' tells the browser to treat them as UTC.
  const normalized = /[Z+]|\d{2}:\d{2}$/.test(iso) ? iso : iso + "Z";
  const diff = Date.now() - new Date(normalized).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}


