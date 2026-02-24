import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type { ChatMessage, MeshNode } from "../lib/types";

// Standard Meshtastic emoji reactions (matching mobile app conventions)
const REACTION_EMOJIS = [
  { code: 128077, label: "\ud83d\udc4d" }, // thumbs up
  { code: 10084, label: "\u2764\ufe0f" },   // red heart
  { code: 128514, label: "\ud83d\ude02" }, // face with tears of joy
  { code: 128078, label: "\ud83d\udc4e" }, // thumbs down
  { code: 127881, label: "\ud83c\udf89" }, // party popper
];

/** Convert a Unicode codepoint to an emoji string */
function emojiFromCode(code: number): string {
  try {
    return String.fromCodePoint(code);
  } catch {
    return "\u2753";
  }
}

/** Format a date for day separators */
function formatDayLabel(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = today.getTime() - msgDay.getTime();
  if (diff === 0) return "Today";
  if (diff === 86_400_000) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Get a day key for grouping messages */
function getDayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Highlight search matches in text */
function HighlightText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const splitRegex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(splitRegex);
  const lowerQuery = query.toLowerCase();
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === lowerQuery ? (
          <mark key={i} className="bg-yellow-500/40 text-yellow-200 rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

interface Props {
  messages: ChatMessage[];
  channels: Array<{ index: number; name: string }>;
  myNodeNum: number;
  onSend: (text: string, channel: number, destination?: number) => Promise<void>;
  onReact: (emoji: number, replyId: number, channel: number) => Promise<void>;
  onNodeClick: (nodeNum: number) => void;
  isConnected: boolean;
  nodes: Map<number, MeshNode>;
  initialDmTarget?: number | null;
  onDmTargetConsumed?: () => void;
}

export default function ChatPanel({
  messages,
  channels,
  myNodeNum,
  onSend,
  onReact,
  onNodeClick,
  isConnected,
  nodes,
  initialDmTarget,
  onDmTargetConsumed,
}: Props) {
  const [input, setInput] = useState("");
  const [channel, setChannel] = useState(0);
  const [sending, setSending] = useState(false);
  const [pickerOpenFor, setPickerOpenFor] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Two-section UI state — load DM tabs from localStorage for restart persistence
  const [viewMode, setViewMode] = useState<"channels" | "dm">("channels");
  const [openDmTabs, setOpenDmTabs] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem("electastic:openDmTabs");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.every((n: unknown) => typeof n === "number")) {
          return parsed;
        }
      }
    } catch { /* ignore corrupt data */ }
    return [];
  });
  const [activeDmNode, setActiveDmNode] = useState<number | null>(null);

  // Persist openDmTabs to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("electastic:openDmTabs", JSON.stringify(openDmTabs));
  }, [openDmTabs]);

  // Track unread counts per channel
  const lastReadRef = useRef<Map<number, number>>(new Map());
  const [unreadCounts, setUnreadCounts] = useState<Map<number, number>>(new Map());

  const getDmLabel = useCallback((nodeNum: number) => {
    const node = nodes.get(nodeNum);
    return node?.short_name || node?.long_name || `!${nodeNum.toString(16)}`;
  }, [nodes]);

  // Handle initialDmTarget from Nodes tab
  useEffect(() => {
    if (initialDmTarget != null) {
      if (!openDmTabs.includes(initialDmTarget)) {
        setOpenDmTabs(prev => [...prev, initialDmTarget]);
      }
      setActiveDmNode(initialDmTarget);
      setViewMode("dm");
      onDmTargetConsumed?.();
    }
  }, [initialDmTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  // Separate regular messages from reaction messages
  const { regularMessages, reactionsByReplyId } = useMemo(() => {
    const regular: ChatMessage[] = [];
    const reactions = new Map<
      number,
      Array<{ emoji: number; sender_name: string }>
    >();

    for (const msg of messages) {
      if (msg.emoji && msg.replyId) {
        const existing = reactions.get(msg.replyId) || [];
        existing.push({ emoji: msg.emoji, sender_name: msg.sender_name });
        reactions.set(msg.replyId, existing);
      } else {
        regular.push(msg);
      }
    }
    return { regularMessages: regular, reactionsByReplyId: reactions };
  }, [messages]);

  // Update unread counts when messages change
  useEffect(() => {
    const counts = new Map<number, number>();
    for (const msg of regularMessages) {
      if (msg.sender_id === myNodeNum) continue; // own messages don't count
      if (msg.to) continue; // DMs don't contribute to channel unread counts
      const lastRead = lastReadRef.current.get(msg.channel) ?? 0;
      if (msg.timestamp > lastRead) {
        counts.set(msg.channel, (counts.get(msg.channel) ?? 0) + 1);
      }
    }
    setUnreadCounts(counts);
  }, [regularMessages, myNodeNum]);

  // Mark current channel as read when switching or viewing
  useEffect(() => {
    if (viewMode === "channels") {
      const now = Date.now();
      lastReadRef.current.set(channel, now);
      setUnreadCounts((prev) => {
        const next = new Map(prev);
        next.delete(channel);
        return next;
      });
    }
  }, [channel, regularMessages.length, viewMode]);

  const filteredMessages = useMemo(() => {
    let msgs: ChatMessage[];

    if (viewMode === "dm" && activeDmNode != null) {
      // DM mode: show conversation between self and active DM node
      msgs = regularMessages.filter(
        (m) =>
          (m.to === activeDmNode && m.sender_id === myNodeNum) ||
          (m.sender_id === activeDmNode && m.to === myNodeNum)
      );
    } else {
      // Channel mode: show only broadcast messages (no DMs)
      msgs = regularMessages.filter(
        (m) => !m.to && (channel === -1 || m.channel === channel)
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      msgs = msgs.filter(
        (m) =>
          m.payload.toLowerCase().includes(q) ||
          m.sender_name.toLowerCase().includes(q)
      );
    }
    return msgs;
  }, [regularMessages, channel, searchQuery, viewMode, activeDmNode, myNodeNum]);

  // Scroll tracking for scroll-to-bottom button
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollButton(distFromBottom > 200);
  }, []);

  // Auto-scroll on new messages (only if near bottom)
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom < 200) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [filteredMessages.length]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPickerOpenFor(null);
        if (showSearch) {
          setShowSearch(false);
        } else if (viewMode === "dm") {
          setViewMode("channels");
        }
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showSearch, viewMode]);

  // Toggle search with Cmd+F / Ctrl+F
  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, []);

  const handleSend = async () => {
    if (!input.trim() || !isConnected || sending) return;
    setSending(true);
    try {
      const sendChannel = channel === -1 ? 0 : channel;
      const destination = viewMode === "dm" && activeDmNode != null ? activeDmNode : undefined;
      await onSend(input.trim(), sendChannel, destination);
      setInput("");
    } catch (err) {
      console.error("Send failed:", err);
    } finally {
      setSending(false);
    }
  };

  const handleReact = async (
    emojiCode: number,
    packetId: number,
    msgChannel: number
  ) => {
    setPickerOpenFor(null);
    try {
      await onReact(emojiCode, packetId, msgChannel);
    } catch (err) {
      console.error("React failed:", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Open a DM tab for a node
  const openDmTo = useCallback((nodeNum: number) => {
    if (!openDmTabs.includes(nodeNum)) {
      setOpenDmTabs(prev => [...prev, nodeNum]);
    }
    setActiveDmNode(nodeNum);
    setViewMode("dm");
  }, [openDmTabs]);

  // Close a DM tab
  const closeDmTab = useCallback((nodeNum: number) => {
    setOpenDmTabs(prev => prev.filter(n => n !== nodeNum));
    if (activeDmNode === nodeNum) {
      // Switch to next tab or back to channels
      const remaining = openDmTabs.filter(n => n !== nodeNum);
      if (remaining.length > 0) {
        setActiveDmNode(remaining[remaining.length - 1]);
      } else {
        setActiveDmNode(null);
        setViewMode("channels");
      }
    }
  }, [activeDmNode, openDmTabs]);

  function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /** Group reactions by emoji code for a given packetId */
  function getGroupedReactions(packetId: number | undefined) {
    if (!packetId) return [];
    const reactions = reactionsByReplyId.get(packetId);
    if (!reactions) return [];

    const grouped = new Map<number, string[]>();
    for (const r of reactions) {
      const existing = grouped.get(r.emoji) || [];
      existing.push(r.sender_name);
      grouped.set(r.emoji, existing);
    }
    return Array.from(grouped.entries()).map(([emoji, senders]) => ({
      emoji,
      count: senders.length,
      tooltip: senders.join(", "),
    }));
  }

  // Pre-compute day separator indices (avoids mutable variable during render)
  const daySeparatorIndices = useMemo(() => {
    const indices = new Set<number>();
    let prevDayKey = "";
    for (let i = 0; i < filteredMessages.length; i++) {
      const dayKey = getDayKey(filteredMessages[i].timestamp);
      if (dayKey !== prevDayKey) {
        indices.add(i);
        prevDayKey = dayKey;
      }
    }
    return indices;
  }, [filteredMessages]);

  const isDmMode = viewMode === "dm" && activeDmNode != null;
  const dmNodeName = activeDmNode != null ? getDmLabel(activeDmNode) : "";

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-10rem)]">
      {/* Row 1 — Channel selector + Search toggle */}
      <div
        className={`flex items-center gap-2 mb-1 ${viewMode === "dm" ? "opacity-50" : ""}`}
      >
        <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mr-1">
          Channels
        </span>
        <button
          onClick={() => { setChannel(-1); setViewMode("channels"); }}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
            viewMode === "channels" && channel === -1
              ? "bg-green-600 text-white"
              : "bg-gray-700 text-gray-400 hover:text-gray-200"
          }`}
        >
          All
        </button>
        {channels.map((ch) => {
          const unread = unreadCounts.get(ch.index) ?? 0;
          return (
            <button
              key={ch.index}
              onClick={() => { setChannel(ch.index); setViewMode("channels"); }}
              className={`relative px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                viewMode === "channels" && channel === ch.index
                  ? "bg-green-600 text-white"
                  : "bg-gray-700 text-gray-400 hover:text-gray-200"
              }`}
            >
              {ch.name}
              {unread > 0 && !(viewMode === "channels" && channel === ch.index) && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </button>
          );
        })}

        <div className="flex-1" />

        {/* Search toggle */}
        <button
          onClick={() => setShowSearch(!showSearch)}
          className={`p-1.5 rounded-lg transition-colors ${
            showSearch
              ? "bg-green-600/30 text-green-400"
              : "text-gray-500 hover:text-gray-300"
          }`}
          title="Search messages (Cmd+F)"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>

      {/* Row 2 — DM tabs */}
      <div
        className={`flex items-center gap-2 mb-2 min-h-[28px] ${viewMode === "channels" ? "opacity-50" : ""}`}
      >
        <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mr-1">
          DMs
        </span>
        {openDmTabs.length === 0 ? (
          <span className="text-[10px] text-gray-600 italic">
            No conversations
          </span>
        ) : (
          openDmTabs.map((nodeNum) => (
            <div
              key={nodeNum}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full transition-colors cursor-pointer ${
                viewMode === "dm" && activeDmNode === nodeNum
                  ? "bg-purple-600 text-white"
                  : "bg-gray-700 text-gray-400 hover:text-gray-200"
              }`}
              onClick={() => { setActiveDmNode(nodeNum); setViewMode("dm"); }}
            >
              <span>{getDmLabel(nodeNum)}</span>
              <button
                onClick={(e) => { e.stopPropagation(); closeDmTab(nodeNum); }}
                className="ml-0.5 text-gray-400 hover:text-white text-[10px] leading-none"
                title="Close DM"
              >
                x
              </button>
            </div>
          ))
        )}
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="mb-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages..."
            className="w-full px-3 py-1.5 bg-gray-700/80 rounded-lg text-gray-200 text-sm border border-gray-600/50 focus:border-green-500/50 focus:outline-none"
            autoFocus
          />
          {searchQuery && (
            <div className="text-xs text-gray-500 mt-1">
              {filteredMessages.length} result{filteredMessages.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}

      {/* Disconnected overlay */}
      {!isConnected && (
        <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-4 mb-2 text-center">
          <p className="text-gray-400 text-sm">
            Not connected — messages are read-only
          </p>
        </div>
      )}

      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-gray-800/50 rounded-xl p-3 space-y-1.5 min-h-0 relative"
      >
        {filteredMessages.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            {searchQuery
              ? "No messages match your search."
              : isDmMode
              ? `No messages with ${dmNodeName} yet.`
              : isConnected
              ? "No messages yet. Send one or wait for incoming messages."
              : "Connect to a device to start chatting."}
          </div>
        ) : (
          filteredMessages.map((msg, i) => {
            const isOwn = msg.sender_id === myNodeNum;
            const isDm = !!msg.to;
            const reactions = getGroupedReactions(msg.packetId);
            const showPicker =
              pickerOpenFor === (msg.packetId ?? -(i + 1));

            // Day separator
            const daySeparator = daySeparatorIndices.has(i) ? (
              <div className="flex items-center gap-3 py-2">
                <div className="flex-1 border-t border-gray-700" />
                <span className="text-xs text-gray-500 font-medium shrink-0">
                  {formatDayLabel(msg.timestamp)}
                </span>
                <div className="flex-1 border-t border-gray-700" />
              </div>
            ) : null;

            return (
              <div key={`${msg.timestamp}-${i}`}>
                {daySeparator}
                <div
                  className={`flex flex-col ${
                    isOwn ? "items-end" : "items-start"
                  }`}
                >
                  {/* Bubble row */}
                  <div
                    className={`group/msg flex items-end gap-1 max-w-[80%] ${
                      isOwn ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    {/* Message bubble */}
                    <div
                      className={`rounded-2xl px-3 py-2 min-w-0 ${
                        isDm
                          ? isOwn
                            ? "rounded-br-sm bg-purple-600/20 border border-purple-500/30"
                            : "rounded-bl-sm bg-purple-700/20 border border-purple-600/30"
                          : isOwn
                          ? "rounded-br-sm bg-blue-600/20 border border-blue-500/30"
                          : "rounded-bl-sm bg-gray-700/50 border border-gray-600/30"
                      }`}
                    >
                      {/* Header: sender name (clickable) + DM indicator + time */}
                      <div className="flex items-center gap-2 mb-0.5">
                        <button
                          onClick={() => onNodeClick(msg.sender_id)}
                          className={`text-xs font-semibold cursor-pointer hover:underline ${
                            isDm
                              ? "text-purple-400"
                              : isOwn
                              ? "text-blue-400"
                              : "text-green-400"
                          }`}
                        >
                          {msg.sender_name}
                        </button>
                        {isDm && (
                          <span className="text-[10px] text-purple-400/70 font-medium">
                            DM
                          </span>
                        )}
                        <span className="text-[10px] text-gray-500/70">
                          {formatTime(msg.timestamp)}
                        </span>
                        {channels.length > 1 && !isDm && (
                          <span className="text-[10px] text-gray-600">
                            ch{msg.channel}
                          </span>
                        )}
                      </div>

                      {/* Message text with optional search highlight */}
                      <p className="text-sm text-gray-200 break-words leading-relaxed">
                        <HighlightText text={msg.payload} query={searchQuery} />
                      </p>

                      {/* Delivery status for own messages */}
                      {isOwn && msg.status && (
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                          {msg.status === "sending" && (
                            <span
                              className="text-[10px] text-gray-500"
                              title="Sending..."
                            >
                              {"⏳"}
                            </span>
                          )}
                          {msg.status === "acked" && (
                            <span
                              className="text-[10px] text-green-500"
                              title="Delivered"
                            >
                              {"✓"}
                            </span>
                          )}
                          {msg.status === "failed" && (
                            <span
                              className="text-[10px] text-red-400 cursor-help"
                              title={msg.error || "Failed to deliver"}
                            >
                              {"✗"} {msg.error || "Failed"}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Inline reaction trigger — visible on hover */}
                    {isConnected && msg.packetId && (
                      <div className="opacity-0 group-hover/msg:opacity-100 flex gap-0.5 transition-all shrink-0">
                        <button
                          onClick={() =>
                            setPickerOpenFor(
                              showPicker
                                ? null
                                : (msg.packetId ?? -(i + 1))
                            )
                          }
                          className="text-gray-600 hover:text-gray-300 text-xs p-1 rounded"
                          title="React"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </button>
                        {/* Quick DM reply */}
                        {!isOwn && (
                          <button
                            onClick={() => openDmTo(msg.sender_id)}
                            className="text-gray-600 hover:text-purple-400 text-xs p-1 rounded"
                            title={`Direct message ${msg.sender_name}`}
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Emoji picker */}
                  {showPicker && (
                    <div
                      className={`flex gap-1 bg-gray-700 border border-gray-600 rounded-xl px-2 py-1.5 mt-1 shadow-lg ${
                        isOwn ? "self-end" : "self-start"
                      }`}
                    >
                      {REACTION_EMOJIS.map((re) => (
                        <button
                          key={re.code}
                          onClick={() =>
                            handleReact(
                              re.code,
                              msg.packetId!,
                              msg.channel
                            )
                          }
                          className="hover:scale-125 transition-transform text-lg px-0.5"
                          title={re.label}
                        >
                          {re.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Reaction badges */}
                  {reactions.length > 0 && (
                    <div
                      className={`flex gap-1 mt-0.5 ${
                        isOwn ? "justify-end" : "justify-start"
                      }`}
                    >
                      {reactions.map((r) => (
                        <span
                          key={r.emoji}
                          className="inline-flex items-center gap-0.5 bg-gray-700/80 border border-gray-600/50 rounded-full px-1.5 py-0.5 text-xs cursor-default"
                          title={r.tooltip}
                        >
                          {emojiFromCode(r.emoji)}
                          {r.count > 1 && (
                            <span className="text-gray-400 text-[10px]">
                              {r.count}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />

        {/* Scroll to bottom button */}
        {showScrollButton && (
          <button
            onClick={scrollToBottom}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-full px-3 py-1.5 text-xs font-medium shadow-lg border border-gray-600 transition-all flex items-center gap-1.5 z-10"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            New messages
          </button>
        )}
      </div>

      {/* Input area */}
      <div className="flex gap-2 mt-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!isConnected || sending}
          placeholder={
            isDmMode
              ? `DM to ${dmNodeName}...`
              : isConnected
              ? "Type a message..."
              : "Connect to send messages"
          }
          className={`flex-1 px-4 py-2.5 rounded-xl text-gray-200 border focus:outline-none disabled:opacity-50 transition-colors ${
            isDmMode
              ? "bg-purple-900/20 border-purple-600/50 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
              : "bg-gray-700/80 border-gray-600/50 focus:border-green-500/50 focus:ring-1 focus:ring-green-500/30"
          }`}
          maxLength={228}
        />
        <button
          onClick={handleSend}
          disabled={!isConnected || !input.trim() || sending}
          className={`px-5 py-2.5 font-medium rounded-xl transition-colors ${
            isDmMode
              ? "bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:text-gray-400 text-white"
              : "bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:text-gray-400 text-white"
          }`}
        >
          {sending ? "..." : isDmMode ? "DM" : "Send"}
        </button>
      </div>
      {/* Character count — only show near limit */}
      {input.length > 180 && (
        <div className="text-xs text-gray-500 mt-1 text-right">
          {input.length}/228
        </div>
      )}
    </div>
  );
}
