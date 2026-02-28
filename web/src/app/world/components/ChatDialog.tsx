"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { loadChat, sendChatMessage } from "@/lib/api/world";
import useWorldStorage from "@/store/WorldStorage";
import { IChatMessage } from "@/types/definitions";

interface ChatApiResponse {
  chats: IChatMessage[];
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Request failed";
}

export default function ChatDialog() {
  const showChatDialog = useWorldStorage((s) => s.showChatDialog);
  const chatDialogData = useWorldStorage((s) => s.chatDialogData);
  const closeChatDialog = useWorldStorage((s) => s.closeChatDialog);
  const character = useWorldStorage((s) => s.character);
  const npcs = useWorldStorage((s) => s.npcs);

  const [messages, setMessages] = useState<IChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const npc = useMemo(() => {
    if (!chatDialogData?.npcID) return null;
    return npcs.find((n) => n._id === chatDialogData.npcID) || null;
  }, [chatDialogData?.npcID, npcs]);

  useEffect(() => {
    if (!showChatDialog || !character?._id || !chatDialogData?.npcID) return;
    setIsLoading(true);
    setError(null);
    loadChat(character._id, chatDialogData.npcID)
      .then((data: ChatApiResponse) => {
        setMessages(data?.chats || []);
      })
      .catch((err: unknown) => {
        setError(getErrorMessage(err));
      })
      .finally(() => setIsLoading(false));
  }, [showChatDialog, character?._id, chatDialogData?.npcID]);

  useEffect(() => {
    if (!showChatDialog) return;
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isSending, isLoading, showChatDialog]);

  const onSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!character?._id || !chatDialogData?.npcID || isSending) return;
    const content = input.trim();
    if (!content) return;
    setIsSending(true);
    setError(null);
    setInput("");
    const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticMessage: IChatMessage = {
      _id: optimisticId,
      sender: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    try {
      const data = await sendChatMessage(character._id, chatDialogData.npcID, content) as ChatApiResponse;
      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m._id !== optimisticId);
        if (Array.isArray(data?.chats) && data.chats.length > 0) {
          return [...withoutOptimistic, ...data.chats];
        }
        return withoutOptimistic;
      });
    } catch (err: unknown) {
      setMessages((prev) => prev.filter((m) => m._id !== optimisticId));
      setError(getErrorMessage(err));
      setInput(content);
    } finally {
      setIsSending(false);
    }
  };

  if (!showChatDialog) return null;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={closeChatDialog}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl border border-black/10 bg-[#f9f7f3] shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Chat dialog"
      >
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
          <h2 className="font-mono text-sm font-semibold">
            Chat with {npc?.first_name || "NPC"} {npc?.last_name || ""}
          </h2>
          <button onClick={closeChatDialog} className="rounded-full px-2 py-1 text-xs text-black/60">
            Close
          </button>
        </div>

        <div ref={messagesContainerRef} className="h-[46vh] overflow-y-auto p-3">
          {isLoading ? (
            <p className="text-xs text-black/50">Loading chat...</p>
          ) : messages.length === 0 ? (
            <p className="text-xs text-black/50">No messages yet. Say hello.</p>
          ) : (
            <div className="space-y-2">
              {messages.map((m) => {
                const mine = m.sender === "user";
                return (
                  <div key={m._id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-xl border px-3 py-2 text-xs ${
                        mine
                          ? "border-black/20 bg-black text-white"
                          : "border-black/10 bg-white text-black"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {isSending && (
            <div className="mt-2 flex justify-start">
              <div className="max-w-[85%] rounded-xl border border-black/10 bg-white px-3 py-2 text-xs text-black/60">
                {npc?.first_name || "NPC"} is typing...
              </div>
            </div>
          )}
          {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
        </div>

        <form onSubmit={onSend} className="border-t border-black/10 p-3">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Write a message..."
              className="flex-1 rounded-lg border border-black/15 bg-white px-3 py-2 font-mono text-xs outline-none"
              maxLength={600}
            />
            <button
              type="submit"
              disabled={!input.trim() || isSending}
              className="rounded-lg border border-black/20 px-3 py-2 font-mono text-xs disabled:opacity-40"
            >
              {isSending ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
