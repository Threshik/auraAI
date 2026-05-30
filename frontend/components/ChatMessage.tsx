import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/cjs/styles/prism";
import { useTheme } from "@/lib/ThemeContext";
import { Message } from "@/types";
import { Bot, Check, Copy, Pencil, RefreshCw, UserRound, FileText } from "lucide-react";

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
  onEdit?: (newContent: string) => void;
  onRegenerate?: () => void;
}

interface CodeBlockProps {
  className?: string;
  children?: React.ReactNode;
}

// Defined outside ChatMessage so it is a stable component reference
function CodeBlock({ className, children }: Readonly<CodeBlockProps>) {
  const { theme } = useTheme();
  const match = /language-(\w+)/.exec(className ?? "");

  if (!match) {
    return (
      <code className="bg-[var(--surface-2)] text-[var(--accent-2)] px-1 py-0.5 rounded text-xs font-mono">
        {children}
      </code>
    );
  }

  // Flatten children to a plain string safely
  let flat = "";
  if (Array.isArray(children)) {
    flat = (children as unknown[]).map((c) => (typeof c === "string" ? c : "")).join("");
  } else if (typeof children === "string") {
    flat = children;
  }

  return (
    <SyntaxHighlighter
      style={theme === "dark" ? oneDark : oneLight}
      language={match[1]}
      PreTag="div"
      className="rounded-xl text-xs !my-0 border border-[var(--border-soft)]"
    >
      {flat.replace(/\n$/, "")}
    </SyntaxHighlighter>
  );
}

const markdownComponents = { code: CodeBlock };

function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-1 py-0.5">
      <span
        className="w-2 h-2 bg-[var(--text-3)] rounded-full animate-bounce"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="w-2 h-2 bg-[var(--text-3)] rounded-full animate-bounce"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="w-2 h-2 bg-[var(--text-3)] rounded-full animate-bounce"
        style={{ animationDelay: "300ms" }}
      />
    </span>
  );
}

function StreamingCursor() {
  return (
    <span className="inline-block w-0.5 h-[1em] bg-current ml-0.5 align-text-bottom animate-pulse" />
  );
}

function formatRelativeTime(iso: string): string {
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

export default function ChatMessage({
  message,
  isStreaming = false,
  onEdit,
  onRegenerate,
}: Readonly<ChatMessageProps>) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(message.content);

  const handleDownloadFile = () => {
    if (!message.file_base64 || !message.file_name) return;
    const link = document.createElement("a");
    link.href = `data:${message.file_media_type || "application/octet-stream"};base64,${message.file_base64}`;
    link.download = message.file_name;
    link.click();
  };

  function handleCopy() {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleEditSubmit() {
    const trimmed = editDraft.trim();
    if (trimmed && trimmed !== message.content && onEdit) {
      onEdit(trimmed);
    }
    setIsEditing(false);
  }

  function handleEditKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEditSubmit();
    }
    if (e.key === "Escape") {
      setEditDraft(message.content);
      setIsEditing(false);
    }
  }

  function renderBubbleContent() {
    if (message.content.length === 0 && isStreaming) {
      return <TypingIndicator />;
    }

    let textNode;
    if (isUser) {
      if (isEditing) {
        textNode = (
          <textarea
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
            onKeyDown={handleEditKeyDown}
            autoFocus
            rows={Math.max(2, editDraft.split("\n").length)}
            className="w-full bg-blue-700 text-white text-sm resize-none outline-none rounded placeholder-blue-300"
          />
        );
      } else {
        textNode = (
          <span className="whitespace-pre-wrap">
            {message.content}
            {isStreaming && <StreamingCursor />}
          </span>
        );
      }
    } else {
      textNode = (
        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:my-2 prose-pre:p-0 prose-code:before:content-none prose-code:after:content-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {message.content}
          </ReactMarkdown>
          {isStreaming && <StreamingCursor />}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-2 w-full">
        {textNode}
        {message.file_base64 && (
          <div className={`mt-2 pt-2 border-t ${isUser ? "border-white/10" : "border-[var(--border-soft)]"}`}>
            {message.file_media_type?.startsWith("image/") ? (
              <div className="relative group max-w-xs mt-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:${message.file_media_type};base64,${message.file_base64}`}
                  alt={message.file_name ?? "Image attachment"}
                  className="max-w-full max-h-60 rounded-xl object-cover border border-white/20 shadow-md transition-all group-hover:scale-[1.01]"
                />
              </div>
            ) : (
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                isUser 
                  ? "bg-white/10 border-white/15 hover:bg-white/15" 
                  : "bg-[var(--surface-2)] border-[var(--border-soft)] hover:bg-[var(--surface-3)]"
              } transition-colors max-w-sm`}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  isUser ? "bg-white/10 text-white" : "bg-[var(--accent-soft)] text-[var(--accent-1)]"
                }`}>
                  <FileText className="w-5 h-5" strokeWidth={2.2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-semibold truncate ${isUser ? "text-white" : "text-[var(--text-1)]"}`}>
                    {message.file_name ?? "Untitled file"}
                  </p>
                  <p className={`text-[10px] uppercase tracking-wider font-medium ${isUser ? "text-white/60" : "text-[var(--text-3)]"}`}>
                    {message.file_media_type?.split("/")[1] ?? "Document"}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const assistantBubbleClass = isStreaming
    ? "streaming-border"
    : "bg-[var(--surface-1)]/95 border-[var(--border-soft)]";

  return (
    <div className={`flex gap-3 group ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold select-none shadow-sm ${
          isUser
            ? "bg-gradient-to-br from-[var(--accent-1)] to-[var(--accent-2)] text-white"
            : "bg-[var(--surface-2)] text-[var(--text-2)]"
        }`}
      >
        {isUser ? (
          <UserRound className="w-4 h-4" strokeWidth={2.2} />
        ) : (
          <Bot className="w-4 h-4" strokeWidth={2.2} />
        )}
      </div>

      {/* Bubble + action buttons */}
      <div className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"} ${isUser ? "max-w-[80%]" : "flex-1 min-w-0"}`}>
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed break-words border ${
            isUser
              ? "bg-gradient-to-br from-[var(--accent-1)] to-[var(--accent-2)] border-[var(--accent-2)] text-white rounded-tr-sm shadow-md shadow-emerald-900/25 whitespace-pre-wrap w-full"
              : `${assistantBubbleClass} text-[var(--text-1)] rounded-tl-sm shadow-sm w-full`
          }`}
        >
          {renderBubbleContent()}
        </div>

        {/* Timestamp */}
        {message.created_at && !isStreaming && (
          <span className={`text-[10px] text-[var(--text-3)] px-1 ${isUser ? "self-end" : "self-start"}`}>
            {formatRelativeTime(message.created_at)}
          </span>
        )}

        {/* Action row — copy / regenerate (assistant) or edit (user) */}
        {!isStreaming && message.content.length > 0 && (
          <div className={`flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? "self-end" : "self-start"}`}>
            {/* Edit button — user messages only */}
            {isUser && onEdit && !isEditing && (
              <button
                onClick={() => { setEditDraft(message.content); setIsEditing(true); }}
                title="Edit message"
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
              >
                <Pencil className="w-3.5 h-3.5 icon-pop" strokeWidth={2.3} />
                Edit
              </button>
            )}

            {/* Save / Cancel when editing */}
            {isUser && isEditing && (
              <>
                <button
                  onClick={handleEditSubmit}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-[var(--accent-1)] text-white hover:bg-[var(--accent-2)] transition-colors"
                >
                  Send
                </button>
                <button
                  onClick={() => { setEditDraft(message.content); setIsEditing(false); }}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  Cancel
                </button>
              </>
            )}

            {/* Copy + Regenerate — assistant messages only */}
            {!isUser && (
              <>
                <button
                  onClick={handleCopy}
                  title="Copy to clipboard"
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-500" strokeWidth={2.4} />
                      <span className="text-green-500">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 icon-pop" strokeWidth={2.3} />
                      Copy
                    </>
                  )}
                </button>

                {onRegenerate && (
                  <button
                    onClick={onRegenerate}
                    title="Regenerate response"
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5 icon-pop" strokeWidth={2.3} />
                    Regenerate
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
