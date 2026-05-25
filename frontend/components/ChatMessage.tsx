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
      <code className="bg-gray-100 dark:bg-gray-700 text-pink-600 dark:text-pink-400 px-1 py-0.5 rounded text-xs font-mono">
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
      className="rounded-lg text-xs !my-0"
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
        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
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
    if (isUser) {
      if (isEditing) {
        return (
          <textarea
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
            onKeyDown={handleEditKeyDown}
            autoFocus
            rows={Math.max(2, editDraft.split("\n").length)}
            className="w-full bg-blue-700 text-white text-sm resize-none outline-none rounded placeholder-blue-300"
          />
        );
      }
      return (
        <>
          {message.content}
          {isStreaming && <StreamingCursor />}
        </>
      );
    }
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:my-2 prose-pre:p-0 prose-code:before:content-none prose-code:after:content-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {message.content}
        </ReactMarkdown>
        {isStreaming && <StreamingCursor />}
      </div>
    );
  }

  return (
    <div className={`flex gap-3 group ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold select-none shadow-sm ${
          isUser
            ? "bg-gradient-to-br from-blue-500 to-blue-700 text-white"
            : "bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 text-gray-500 dark:text-gray-300"
        }`}
      >
        {isUser ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97z" clipRule="evenodd" />
          </svg>
        )}
      </div>

      {/* Bubble + action buttons */}
      <div className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"} ${isUser ? "max-w-[80%]" : "flex-1 min-w-0"}`}>
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed break-words ${
            isUser
              ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-tr-sm shadow-md shadow-blue-500/20 whitespace-pre-wrap w-full"
              : "bg-white dark:bg-gray-800/80 border border-gray-100 dark:border-white/[0.06] text-gray-800 dark:text-gray-100 rounded-tl-sm shadow-sm w-full"
          }`}
        >
          {renderBubbleContent()}
        </div>

        {/* Timestamp */}
        {message.created_at && !isStreaming && (
          <span className={`text-[10px] text-gray-400 dark:text-gray-600 px-1 ${isUser ? "self-end" : "self-start"}`}>
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
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M13.488 2.513a1.75 1.75 0 00-2.475 0L6.75 6.774a2.75 2.75 0 00-.596.892l-.848 2.047a.75.75 0 00.98.98l2.047-.848a2.75 2.75 0 00.892-.596l4.261-4.263a1.75 1.75 0 000-2.474zM4.75 14.25h-2a.75.75 0 010-1.5h2a.75.75 0 010 1.5z" />
                </svg>
                Edit
              </button>
            )}

            {/* Save / Cancel when editing */}
            {isUser && isEditing && (
              <>
                <button
                  onClick={handleEditSubmit}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  Send
                </button>
                <button
                  onClick={() => { setEditDraft(message.content); setIsEditing(false); }}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {copied ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-green-500">
                        <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                      </svg>
                      <span className="text-green-500">Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                        <path fillRule="evenodd" d="M11.986 3H12a2 2 0 0 1 2 2v6a2 2 0 0 1-1.5 1.937V7A2.5 2.5 0 0 0 10 4.5H4.063A2 2 0 0 1 6 3h.014A2.25 2.25 0 0 1 8.25 1h1.5a2.25 2.25 0 0 1 2.236 2ZM10.5 4v-.175a.75.75 0 0 0-.75-.75h-1.5a.75.75 0 0 0-.75.75V4h3Z" clipRule="evenodd" />
                        <path d="M3 6a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H3Z" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>

                {onRegenerate && (
                  <button
                    onClick={onRegenerate}
                    title="Regenerate response"
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                      <path fillRule="evenodd" d="M8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.204 1.204A.25.25 0 0 1 4.896 6H1.25A.25.25 0 0 1 1 5.75V2.104a.25.25 0 0 1 .427-.177l1.38 1.38A7.001 7.001 0 0 1 14.95 7.16a.75.75 0 0 1-1.49.178A5.501 5.501 0 0 0 8 2.5ZM1.705 8.005a.75.75 0 0 1 .834.656 5.501 5.501 0 0 0 9.592 2.97l-1.204-1.204a.25.25 0 0 1 .177-.427h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7.002 7.002 0 0 1 1.05 8.84a.75.75 0 0 1 .656-.834Z" clipRule="evenodd" />
                    </svg>
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
