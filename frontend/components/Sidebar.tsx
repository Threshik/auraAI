"use client";

import { useRef, useState } from "react";
import { Conversation } from "@/types";
import {
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Ellipsis,
  Bot,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

interface SidebarProps {
  conversations: Conversation[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onNewChat: () => void;
  onRename: (id: number, title: string) => void;
  onDelete: (id: number) => void;
  isCreating: boolean;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onRename,
  onDelete,
  isCreating,
  isOpen,
  setIsOpen,
}: Readonly<SidebarProps>) {
  const { user, logout } = useAuth();
  const [editingId, setEditingId] = useState<number | null>(null);

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName ?? ""}`.trim()
    : (user?.username ?? "Developer");
  const avatarInitial = (
    user?.firstName?.[0] ?? 
    user?.username?.[0] ?? 
    "D"
  ).toUpperCase();
  const subtext = user?.email ?? "Workspace User";
  const [editValue, setEditValue] = useState("");
  const [search, setSearch] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  if (!isOpen) {
    return (
      <aside className="glass-panel w-full flex flex-col items-center py-4 h-full bg-[var(--surface-1)] border-r border-[var(--border-soft)] transition-all duration-300">
        {/* Top actions */}
        <div className="flex flex-col items-center gap-4 w-full">
          {/* Toggle expand button */}
          <button
            onClick={() => setIsOpen(true)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors active:scale-95 cursor-pointer"
            title="Show sidebar"
          >
            <PanelLeftOpen className="w-5 h-5 icon-pop" strokeWidth={2} />
          </button>
          
          {/* Compose / New Chat button */}
          <button
            onClick={onNewChat}
            disabled={isCreating}
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--accent-1)] hover:bg-[var(--accent-2)] text-white transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            title="New chat"
          >
            <Plus className="w-5 h-5 icon-pop" strokeWidth={2.3} />
          </button>

          {/* Search trigger */}
          <button
            onClick={() => {
              setIsOpen(true);
              setSearchActive(true);
              setTimeout(() => searchInputRef.current?.focus(), 150);
            }}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors active:scale-95 cursor-pointer"
            title="Search chats"
          >
            <Search className="w-5 h-5 icon-pop" strokeWidth={2} />
          </button>
        </div>

        {/* Pinned Profile avatar at the bottom */}
        <div className="mt-auto flex justify-center w-full">
          <div 
            onClick={() => setIsOpen(true)}
            className="w-10 h-10 rounded-full bg-gradient-to-tr from-[var(--accent-1)] to-[var(--accent-2)] text-white flex items-center justify-center font-bold text-sm shadow-md hover:scale-105 transition-transform cursor-pointer" 
            title={displayName}
          >
            {avatarInitial}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="glass-panel w-full flex flex-col h-full bg-[var(--surface-1)] border-r border-[var(--border-soft)] transition-all duration-300">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-3.5 py-4 border-b border-[var(--border-soft)]">
        {/* Brand */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[var(--accent-1)] to-[var(--accent-2)] flex items-center justify-center shrink-0 shadow-sm">
            <Bot className="w-3.5 h-3.5 text-white" strokeWidth={2.2} />
          </div>
          <span className="font-semibold text-xs text-[var(--text-1)] tracking-wider uppercase opacity-85 truncate">Aura AI</span>
        </div>

        {/* Toggle Collapse */}
        <button
          onClick={() => setIsOpen(false)}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors active:scale-95 cursor-pointer"
          title="Hide sidebar"
        >
          <PanelLeftClose className="w-4.5 h-4.5 icon-pop" strokeWidth={2} />
        </button>
      </div>

      {/* Main navigation list */}
      <div className="px-2.5 py-3 space-y-0.5 border-b border-[var(--border-soft)]">
        {/* New Chat Item */}
        <button
          onClick={onNewChat}
          disabled={isCreating}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-medium text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
        >
          <Plus className="w-4.5 h-4.5 text-[var(--accent-1)]" strokeWidth={2.3} />
          <span>New chat</span>
        </button>

        {/* Search Chats Item (Dynamic Inline search) */}
        {searchActive ? (
          <div className="relative w-full flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--accent-1)]/40 fade-in-up">
            <Search className="w-4.5 h-4.5 text-[var(--text-3)] shrink-0" strokeWidth={2} />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats…"
              className="flex-1 bg-transparent text-[var(--text-1)] text-xs outline-none min-w-0"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearch("");
                  setSearchActive(false);
                }
              }}
            />
            <button
              onClick={() => {
                setSearch("");
                setSearchActive(false);
              }}
              className="text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors shrink-0 cursor-pointer"
              title="Close search"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setSearchActive(true);
              setTimeout(() => searchInputRef.current?.focus(), 50);
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-medium text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-all active:scale-[0.99] cursor-pointer"
          >
            <Search className="w-4.5 h-4.5 text-[var(--text-3)]" strokeWidth={2} />
            <span>Search chats</span>
          </button>
        )}


      </div>

      {/* Recents Chat List */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="px-3 mb-2 flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-wider text-[var(--text-3)] uppercase opacity-85">Recents</span>
        </div>

        <div className="space-y-0.5">
          {filtered.length === 0 ? (
            <p className="text-[var(--text-3)] text-xs px-3 py-3 text-center italic">
              {search ? "No matching chats" : "No conversations yet"}
            </p>
          ) : (
            filtered.map((conv) => (
              <div
                key={conv.id}
                className={`group relative flex items-center rounded-xl transition-all border border-transparent ${
                  conv.id === activeId
                    ? "bg-[var(--surface-2)] border-[var(--border-soft)]"
                    : "hover:bg-[var(--surface-2)]/60"
                }`}
              >
                {editingId === conv.id ? (
                  <input
                    ref={inputRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => commitRename(conv.id)}
                    onKeyDown={(e) => handleRenameKey(e, conv.id)}
                    className="flex-1 bg-transparent text-[var(--text-1)] text-xs px-3 py-2.5 outline-none min-w-0 font-medium"
                  />
                ) : (
                  <button
                    onClick={() => onSelect(conv.id)}
                    onDoubleClick={(e) => startRename(conv, e)}
                    className={`flex-1 text-left pl-3 pr-14 py-2.5 text-sm flex items-center min-w-0 ${
                      conv.id === activeId ? "text-[var(--text-1)] font-semibold" : "text-[var(--text-2)] font-medium group-hover:text-[var(--text-1)]"
                    }`}
                  >
                    <span className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <span className="truncate text-[13px] tracking-tight">{conv.title}</span>
                      {conv.updated_at && (
                        <span className="text-[10px] text-[var(--text-3)] opacity-80 group-hover:opacity-100 truncate">
                          {formatRelative(conv.updated_at)}
                        </span>
                      )}
                    </span>
                  </button>
                )}

                {/* Actions on Hover */}
                {editingId !== conv.id && (
                  <div className="absolute right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-l from-[var(--surface-2)] pl-4 py-1 shrink-0 rounded-r-xl">
                    <button
                      onClick={(e) => startRename(conv, e)}
                      title="Rename"
                      className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-3)] transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" strokeWidth={2.3} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                      title="Delete"
                      className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--text-3)] hover:text-red-500 hover:bg-[var(--surface-3)] transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={2.3} />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* User Profile Block at bottom */}
      <div className="mt-auto px-3.5 py-4 border-t border-[var(--border-soft)] bg-[var(--surface-1)]">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[var(--accent-1)] to-[var(--accent-2)] text-white flex items-center justify-center font-bold text-[11px] shrink-0 shadow-sm">
              {avatarInitial}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-[var(--text-1)] truncate" title={displayName}>{displayName}</span>
              <span className="text-[9px] text-[var(--text-3)] leading-none truncate" title={subtext}>{subtext}</span>
            </div>
          </div>
          
          <button 
            onClick={logout}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function formatRelative(iso: string): string {
  // Backend returns naive UTC datetimes without a timezone suffix.
  // Appending 'Z' tells the browser to treat them as UTC.
  const normalized = /([Z+]|\d{2}:\d{2})$/.test(iso) ? iso : iso + "Z";
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
