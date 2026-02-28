"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { generateChatImagePreview, loadChat, sendChatImage, sendChatMessage } from "@/lib/api/world";
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
  const [showImagePromptPopup, setShowImagePromptPopup] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [imagePreviewURL, setImagePreviewURL] = useState("");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
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
      const data = (await sendChatMessage(character._id, chatDialogData.npcID, content)) as ChatApiResponse;
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

  const generateImagePreview = async () => {
    if (!character?._id || !chatDialogData?.npcID || isSending || isGeneratingImage) return;
    const prompt = imagePrompt.trim();
    if (!prompt) return;
    setError(null);
    setIsGeneratingImage(true);
    try {
      const data = (await generateChatImagePreview(character._id, chatDialogData.npcID, prompt)) as { imageUrl?: string };
      if (!data?.imageUrl) throw new Error("Image generation failed");
      setImagePreviewURL(data.imageUrl);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const onSendImage = async (e: FormEvent) => {
    e.preventDefault();
    if (!character?._id || !chatDialogData?.npcID || isSending) return;
    const prompt = imagePrompt.trim();
    if (!prompt || !imagePreviewURL) return;
    setIsSending(true);
    setError(null);
    const selectedPreviewURL = imagePreviewURL;
    const optimisticId = `optimistic-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticMessage: IChatMessage = {
      _id: optimisticId,
      sender: "user",
      type: "image",
      content: prompt,
      image_url: selectedPreviewURL,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    try {
      const data = (await sendChatImage(character._id, chatDialogData.npcID, prompt, selectedPreviewURL)) as ChatApiResponse;
      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m._id !== optimisticId);
        if (Array.isArray(data?.chats) && data.chats.length > 0) {
          return [...withoutOptimistic, ...data.chats];
        }
        return withoutOptimistic;
      });
      setImagePrompt("");
      setImagePreviewURL("");
      setShowImagePromptPopup(false);
    } catch (err: unknown) {
      setMessages((prev) => prev.filter((m) => m._id !== optimisticId));
      setError(getErrorMessage(err));
    } finally {
      setIsSending(false);
    }
  };

  if (!showChatDialog) return null;

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeChatDialog}>
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
                const isImage = m.type === "image";
                return (
                  <div key={m._id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-xl border px-3 py-2 text-xs ${
                        mine ? "border-black/20 bg-black text-white" : "border-black/10 bg-white text-black"
                      }`}
                    >
                      {isImage ? (
                        <div className="space-y-2">
                          {m.image_url ? (
                            <img
                              src={m.image_url}
                              alt={m.content}
                              width={640}
                              height={640}
                              className="max-h-56 w-full rounded-lg border border-black/15 object-cover"
                            />
                          ) : (
                            <div className="rounded-lg border border-black/15 bg-black/5 px-2 py-1">Image sent</div>
                          )}
                        </div>
                      ) : (
                        m.content
                      )}
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
            <button
              type="button"
              disabled={isSending}
              onClick={() => {
                setShowImagePromptPopup(true);
                setImagePrompt("");
                setImagePreviewURL("");
              }}
              className="rounded-lg border border-black/20 px-3 py-2 font-mono text-xs disabled:opacity-40"
              aria-label="Send image"
              title="Send image"
            >
              <span aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                  <rect x="3.75" y="4.5" width="16.5" height="15" rx="2.25" />
                  <circle cx="9" cy="9" r="1.2" />
                  <path d="M4.5 16.5 9.9 11.1a1.5 1.5 0 0 1 2.12 0l2.15 2.15a1.5 1.5 0 0 0 2.12 0l3.2-3.2" />
                </svg>
              </span>
            </button>
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

      {showImagePromptPopup && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-md rounded-2xl border border-black/10 bg-[#f9f7f3] p-4 shadow-xl"
            role="dialog"
            aria-label="Describe image prompt"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-mono text-sm font-semibold">Send image to NPC</h3>
            <p className="mt-2 text-xs text-black/60">Describe the image you want to send.</p>
            <form onSubmit={onSendImage} className="mt-3 space-y-3">
              <textarea
                value={imagePrompt}
                onChange={(e) => {
                  setImagePrompt(e.target.value);
                  setImagePreviewURL("");
                }}
                placeholder="Describe image..."
                className="h-28 w-full resize-none rounded-lg border border-black/15 bg-white px-3 py-2 font-mono text-xs outline-none"
                maxLength={400}
              />
              {imagePreviewURL ? (
                <div className="space-y-2">
                  <img
                    src={imagePreviewURL}
                    alt="Generated preview"
                    width={640}
                    height={640}
                    className="max-h-64 w-full rounded-lg border border-black/15 object-cover"
                  />
                  <p className="text-xs text-black/60">Preview ready.</p>
                </div>
              ) : (
                <p className="text-xs text-black/60">Generate a preview first.</p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowImagePromptPopup(false);
                    setImagePrompt("");
                    setImagePreviewURL("");
                  }}
                  className="rounded-lg border border-black/20 px-3 py-2 font-mono text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={generateImagePreview}
                  disabled={!imagePrompt.trim() || isSending || isGeneratingImage}
                  className="rounded-lg border border-black/20 px-3 py-2 font-mono text-xs disabled:opacity-40"
                >
                  {isGeneratingImage ? "Generating..." : imagePreviewURL ? "Regenerate" : "Generate"}
                </button>
                <button
                  type="submit"
                  disabled={!imagePrompt.trim() || !imagePreviewURL || isSending || isGeneratingImage}
                  className="rounded-lg border border-black/20 px-3 py-2 font-mono text-xs disabled:opacity-40"
                >
                  {isSending ? "Sending..." : "Send"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
