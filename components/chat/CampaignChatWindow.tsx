"use client";

import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  CampaignChatMessage,
  CampaignChatParticipant,
  CampaignChatTheme,
} from "./campaignChatTypes";

type MessageInsertRow = {
  id: string;
  campaign_id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type ReadRow = {
  thread_id: string;
  user_id: string;
  last_read_at: string;
};

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function normalizeRpcMessage(
  value: MessageInsertRow,
  currentUser: CampaignChatParticipant
): CampaignChatMessage {
  return {
    id: value.id,
    campaignId: value.campaign_id,
    threadId: value.thread_id,
    senderId: value.sender_id,
    senderName: currentUser.displayName,
    senderRole: currentUser.role,
    content: value.content,
    createdAt: value.created_at,
  };
}

function firstRow<T>(value: T[] | T | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function CampaignChatWindow({
  threadId,
  currentUser,
  otherParticipant,
  initialMessages,
  initialOtherLastReadAt,
  theme,
}: {
  threadId: string;
  currentUser: CampaignChatParticipant;
  otherParticipant: CampaignChatParticipant;
  initialMessages: CampaignChatMessage[];
  initialOtherLastReadAt: string | null;
  theme: CampaignChatTheme;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [otherLastReadAt, setOtherLastReadAt] = useState(
    initialOtherLastReadAt
  );
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const refreshedReadThreadRef = useRef<string | null>(null);
  const barovia = theme === "barovia";

  useEffect(() => {
    setMessages(initialMessages);
    setOtherLastReadAt(initialOtherLastReadAt);
    setMessageText("");
    setErrorMessage(null);
    setSaveWarning(null);
  }, [initialMessages, initialOtherLastReadAt, threadId]);

  const markRead = useCallback(async () => {
    const supabase = createClient();
    const { error } = await supabase.rpc("mark_campaign_chat_read", {
      p_thread_id: threadId,
    });

    if (error) {
      console.warn("Conversation could not be marked as read:", error.message);
      return;
    }

    if (refreshedReadThreadRef.current !== threadId) {
      refreshedReadThreadRef.current = threadId;
      router.refresh();
    }
  }, [router, threadId]);

  useEffect(() => {
    void markRead();

    function handleVisibility() {
      if (document.visibilityState === "visible") void markRead();
    }

    window.addEventListener("focus", markRead);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", markRead);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [markRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`campaign-chat-thread:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "campaign_chat_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload: { new: unknown }) => {
          const row = payload.new as MessageInsertRow;
          const sender =
            row.sender_id === currentUser.id ? currentUser : otherParticipant;
          const nextMessage: CampaignChatMessage = {
            id: row.id,
            campaignId: row.campaign_id,
            threadId: row.thread_id,
            senderId: row.sender_id,
            senderName: sender.displayName,
            senderRole: sender.role,
            content: row.content,
            createdAt: row.created_at,
          };

          setMessages((current) =>
            current.some((message) => message.id === nextMessage.id)
              ? current
              : [...current, nextMessage]
          );

          if (row.sender_id !== currentUser.id) void markRead();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaign_chat_reads",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload: { new: unknown }) => {
          const row = payload.new as ReadRow;
          if (row.user_id === otherParticipant.id) {
            setOtherLastReadAt(row.last_read_at);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUser, markRead, otherParticipant, threadId]);

  const latestOwnMessageId = useMemo(
    () =>
      [...messages]
        .reverse()
        .find((message) => message.senderId === currentUser.id)?.id ?? null,
    [currentUser.id, messages]
  );

  function isReadByOther(message: CampaignChatMessage) {
    if (!otherLastReadAt || message.senderId !== currentUser.id) return false;
    return new Date(message.createdAt).getTime() <= new Date(otherLastReadAt).getTime();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = messageText.trim();

    if (!content || isSending) return;

    setIsSending(true);
    setErrorMessage(null);
    setSaveWarning(null);

    const supabase = createClient();
    const { data, error } = await supabase.rpc("send_campaign_chat_message", {
      p_thread_id: threadId,
      p_content: content,
    });

    if (error) {
      setErrorMessage(error.message);
      setIsSending(false);
      return;
    }

    const row = firstRow(data as MessageInsertRow[] | MessageInsertRow | null);
    if (row) {
      const nextMessage = normalizeRpcMessage(row, currentUser);
      setMessages((current) =>
        current.some((message) => message.id === nextMessage.id)
          ? current
          : [...current, nextMessage]
      );
    } else {
      setSaveWarning("The message was sent, but its saved copy could not be loaded immediately.");
    }

    setMessageText("");
    setIsSending(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  return (
    <section
      className={`flex min-h-[680px] flex-col overflow-hidden rounded-3xl border shadow-2xl ${
        barovia
          ? "border-[#4e2b36] bg-[#120c10]/94 shadow-black/35"
          : "border-slate-800 bg-slate-900 shadow-slate-950/30"
      }`}
    >
      <header
        className={`border-b px-5 py-4 ${
          barovia
            ? "border-[#412630] bg-[#0b080a]/65"
            : "border-slate-800 bg-slate-950/50"
        }`}
      >
        <p
          className={`text-xs uppercase tracking-[0.3em] ${
            barovia ? "text-[#a95b70]" : "text-yellow-500"
          }`}
        >
          {barovia ? "A private whisper" : "Private conversation"}
        </p>

        <div className="mt-2 flex items-center gap-3">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-full border font-serif font-black ${
              barovia
                ? "border-[#794052] bg-[#5a1825]/35 text-[#efc7d1]"
                : "border-yellow-600/30 bg-yellow-500/10 text-yellow-300"
            }`}
          >
            {otherParticipant.displayName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h2
              className={`text-lg font-bold ${
                barovia ? "text-[#ead7dc]" : "text-slate-100"
              }`}
            >
              {otherParticipant.displayName}
            </h2>
            <p
              className={`text-[10px] uppercase tracking-[0.2em] ${
                barovia ? "text-[#81646e]" : "text-slate-500"
              }`}
            >
              {otherParticipant.role === "dm" ? "Game Master" : "Player"}
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 md:px-6">
        {messages.length === 0 && (
          <div className="flex min-h-[360px] items-center justify-center">
            <div className="max-w-sm text-center">
              <div
                className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full border text-xl ${
                  barovia
                    ? "border-[#5b3040] bg-[#5a1825]/20 text-[#d58da0]"
                    : "border-slate-700 bg-slate-950/70 text-yellow-300"
                }`}
              >
                {barovia ? "✦" : "✉"}
              </div>
              <h3
                className={`mt-4 text-lg font-bold ${
                  barovia ? "text-[#ddcbd1]" : "text-slate-200"
                }`}
              >
                {barovia ? "The Mists are silent" : "No messages yet"}
              </h3>
              <p
                className={`mt-2 text-sm leading-6 ${
                  barovia ? "text-[#8f7e84]" : "text-slate-500"
                }`}
              >
                Only this player and the Game Master can read what is written here.
              </p>
            </div>
          </div>
        )}

        {messages.map((message) => {
          const own = message.senderId === currentUser.id;
          const showRead =
            own && message.id === latestOwnMessageId && isReadByOther(message);

          return (
            <article
              key={message.id}
              className={`flex ${own ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl border px-4 py-3 md:max-w-[72%] ${
                  barovia
                    ? own
                      ? "border-[#7f3c51]/65 bg-[#5a1825]/28"
                      : "border-[#3d2830] bg-black/25"
                    : own
                      ? "border-yellow-600/30 bg-yellow-500/10"
                      : "border-slate-700 bg-slate-950/70"
                }`}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p
                    className={`text-xs font-bold ${
                      barovia
                        ? own
                          ? "text-[#e6a8b8]"
                          : "text-[#c9b8bd]"
                        : own
                          ? "text-yellow-300"
                          : "text-slate-300"
                    }`}
                  >
                    {message.senderName}
                  </p>
                  <time
                    className={`text-[10px] ${
                      barovia ? "text-[#705b63]" : "text-slate-600"
                    }`}
                  >
                    {formatMessageTime(message.createdAt)}
                  </time>
                </div>
                <p
                  className={`mt-2 whitespace-pre-wrap break-words text-sm leading-6 ${
                    barovia ? "text-[#e0d4d7]" : "text-slate-200"
                  }`}
                >
                  {message.content}
                </p>
                {showRead && (
                  <p
                    className={`mt-2 text-right text-[10px] font-semibold uppercase tracking-[0.15em] ${
                      barovia ? "text-[#9d6675]" : "text-slate-500"
                    }`}
                  >
                    Read
                  </p>
                )}
              </div>
            </article>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className={`sticky bottom-0 border-t p-4 ${
          barovia
            ? "border-[#412630] bg-[#0d090c]/96"
            : "border-slate-800 bg-slate-950/95"
        }`}
      >
        {(errorMessage || saveWarning) && (
          <div
            className={`mb-3 rounded-xl border px-4 py-3 text-sm ${
              errorMessage
                ? "border-red-500/30 bg-red-500/10 text-red-300"
                : "border-amber-500/30 bg-amber-500/10 text-amber-200"
            }`}
          >
            {errorMessage
              ? `Message could not be sent: ${errorMessage}`
              : saveWarning}
          </div>
        )}

        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={messageText}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
              setMessageText(event.target.value)
            }
            onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            maxLength={4000}
            rows={2}
            placeholder={
              barovia
                ? `Send a whisper to ${otherParticipant.displayName}...`
                : `Write a message to ${otherParticipant.displayName}...`
            }
            className={`min-h-[52px] flex-1 resize-none rounded-xl border px-4 py-3 text-sm outline-none transition ${
              barovia
                ? "border-[#4b3039] bg-black/30 text-[#eadfe3] placeholder:text-[#69565d] focus:border-[#98516a]"
                : "border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600 focus:border-yellow-500"
            }`}
          />

          <button
            type="submit"
            disabled={isSending || messageText.trim().length === 0}
            className={`h-[52px] rounded-xl px-5 font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              barovia
                ? "bg-[#7e2d46] text-[#f5e7eb] hover:bg-[#963a56]"
                : "bg-yellow-500 text-slate-950 hover:bg-yellow-400"
            }`}
          >
            {isSending ? "Sending..." : barovia ? "Whisper" : "Send"}
          </button>
        </div>
        <p
          className={`mt-2 text-xs ${
            barovia ? "text-[#69565d]" : "text-slate-600"
          }`}
        >
          Enter to send · Shift + Enter for a new line
        </p>
      </form>
    </section>
  );
}
