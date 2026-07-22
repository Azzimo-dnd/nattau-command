"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  ChatMessage,
  ChatMessageView,
  ChatProfile,
} from "./chatTypes";

type ChatWindowProps = {
  conversationId: string;
  currentUser: ChatProfile;
  otherParticipant: ChatProfile;
  initialMessages: ChatMessageView[];
};

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ChatWindow({
  conversationId,
  currentUser,
  otherParticipant,
  initialMessages,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessageView[]>(initialMessages);
  const [messageText, setMessageText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`gm-chat:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "gm_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          const sender =
            newMessage.sender_id === currentUser.id
              ? currentUser
              : otherParticipant;

          const messageView: ChatMessageView = {
            ...newMessage,
            sender_name: sender.display_name,
            sender_role: sender.role,
          };

          setMessages((currentMessages) =>
            currentMessages.some((message) => message.id === messageView.id)
              ? currentMessages
              : [...currentMessages, messageView]
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, currentUser, otherParticipant]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = messageText.trim();

    if (!content || isSending) {
      return;
    }

    setErrorMessage(null);
    setIsSending(true);

    const supabase = createClient();

    const { data, error } = await supabase
      .from("gm_messages")
      .insert({
        conversation_id: conversationId,
        sender_id: currentUser.id,
        content,
      })
      .select("id, conversation_id, sender_id, content, created_at, read_at")
      .single();

    if (error) {
      setErrorMessage(error.message);
      setIsSending(false);
      return;
    }

    const insertedMessage: ChatMessageView = {
      ...(data as ChatMessage),
      sender_name: currentUser.display_name,
      sender_role: currentUser.role,
    };

    setMessages((currentMessages) =>
      currentMessages.some((message) => message.id === insertedMessage.id)
        ? currentMessages
        : [...currentMessages, insertedMessage]
    );

    setMessageText("");
    setIsSending(false);
  }

  return (
    <section className="flex min-h-[680px] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
      <header className="border-b border-slate-800 bg-slate-950/50 px-5 py-4">
        <p className="text-xs uppercase tracking-[0.3em] text-yellow-500">
          Private Conversation
        </p>

        <div className="mt-2 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-yellow-600/30 bg-yellow-500/10 font-black text-yellow-300">
            {otherParticipant.display_name.slice(0, 1).toUpperCase()}
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-100">
              {otherParticipant.display_name}
            </h2>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {otherParticipant.role === "dm" ? "Game Master" : "Player"}
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 md:px-6">
        {messages.length === 0 && (
          <div className="flex min-h-[360px] items-center justify-center">
            <div className="max-w-sm text-center">
              <p className="text-4xl">💬</p>
              <h3 className="mt-4 text-lg font-bold text-slate-200">
                No messages yet
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                This is a private conversation between the player and the Game Master.
              </p>
            </div>
          </div>
        )}

        {messages.map((message) => {
          const isOwnMessage = message.sender_id === currentUser.id;

          return (
            <article
              key={message.id}
              className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl border px-4 py-3 md:max-w-[70%] ${
                  isOwnMessage
                    ? "border-yellow-600/30 bg-yellow-500/10"
                    : "border-slate-700 bg-slate-950/70"
                }`}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p
                    className={`text-xs font-bold ${
                      isOwnMessage ? "text-yellow-300" : "text-slate-300"
                    }`}
                  >
                    {message.sender_name}
                  </p>
                  <time className="text-[10px] text-slate-600">
                    {formatMessageTime(message.created_at)}
                  </time>
                </div>

                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">
                  {message.content}
                </p>
              </div>
            </article>
          );
        })}

        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-slate-800 bg-slate-950/40 p-4"
      >
        {errorMessage && (
          <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            Message could not be sent: {errorMessage}
          </div>
        )}

        <div className="flex items-end gap-3">
          <textarea
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
            onKeyDown={(event) => {
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
            placeholder={`Write a message to ${otherParticipant.display_name}...`}
            className="min-h-[52px] flex-1 resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-yellow-500"
          />

          <button
            type="submit"
            disabled={isSending || messageText.trim().length === 0}
            className="h-[52px] rounded-xl bg-yellow-500 px-5 font-bold text-slate-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSending ? "Sending..." : "Send"}
          </button>
        </div>

        <p className="mt-2 text-xs text-slate-600">
          Enter to send · Shift + Enter for a new line
        </p>
      </form>
    </section>
  );
}
