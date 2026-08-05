"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";

type UnreadSummary = {
  campaignId: string | null;
  unreadMessages: number;
  unreadThreads: number;
};

type NotificationContextValue = UnreadSummary & {
  campaignSlug: string;
  refresh: () => Promise<void>;
};

type ToastState = {
  message: string;
  href: string;
} | null;

type SummaryRow = {
  campaign_id: string;
  unread_messages: number | string | null;
  unread_threads: number | string | null;
};

type MessagePayload = {
  campaign_id?: string;
  sender_id?: string;
};

const CampaignChatNotificationContext =
  createContext<NotificationContextValue | null>(null);

function firstRow<T>(value: T[] | T | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function fetchUnreadSummary(campaignSlug: string): Promise<UnreadSummary> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "get_campaign_chat_unread_summary",
    { p_campaign_slug: campaignSlug }
  );

  if (error) {
    // The navigation remains usable while the SQL migration is being installed.
    console.warn("Unread chat summary could not be loaded:", error.message);
    return {
      campaignId: null,
      unreadMessages: 0,
      unreadThreads: 0,
    };
  }

  const row = firstRow(data as SummaryRow[] | SummaryRow | null);
  return {
    campaignId: row?.campaign_id ?? null,
    unreadMessages: Number(row?.unread_messages ?? 0),
    unreadThreads: Number(row?.unread_threads ?? 0),
  };
}

export function CampaignChatNotificationsProvider({
  campaignSlug,
  chatHref,
  theme,
  children,
}: {
  campaignSlug: string;
  chatHref: string;
  theme: "nattau" | "barovia";
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [summary, setSummary] = useState<UnreadSummary>({
    campaignId: null,
    unreadMessages: 0,
    unreadThreads: 0,
  });
  const [toast, setToast] = useState<ToastState>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null | undefined>(undefined);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    setSummary(await fetchUnreadSummary(campaignSlug));
  }, [campaignSlug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const supabase = createClient();

    void supabase.auth.getUser().then(({ data }: { data: { user?: { id: string } | null } }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!summary.campaignId || currentUserId === undefined) return;

    const supabase = createClient();
    const campaignFilter = `campaign_id=eq.${summary.campaignId}`;

    const channel = supabase
      .channel(`campaign-chat-notifications:${campaignSlug}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "campaign_chat_messages",
          filter: campaignFilter,
        },
        (payload: { new: unknown }) => {
          const message = payload.new as MessagePayload;
          void refresh();

          const isOwnMessage =
            Boolean(currentUserId) && message.sender_id === currentUserId;
          const isInsideChat = pathname.startsWith(chatHref);

          if (!isOwnMessage && !isInsideChat) {
            setToast({
              message:
                theme === "barovia"
                  ? "A new whisper has reached you through the Mists."
                  : "A new message has reached your private campaign channel.",
              href: chatHref,
            });

            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            toastTimerRef.current = setTimeout(() => setToast(null), 6500);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaign_chat_reads",
          filter: campaignFilter,
        },
        () => {
          void refresh();
        }
      )
      .subscribe();

    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [
    chatHref,
    campaignSlug,
    currentUserId,
    pathname,
    refresh,
    summary.campaignId,
    theme,
  ]);

  const value = useMemo<NotificationContextValue>(
    () => ({
      campaignSlug,
      ...summary,
      refresh,
    }),
    [campaignSlug, refresh, summary]
  );

  const barovia = theme === "barovia";

  return (
    <CampaignChatNotificationContext.Provider value={value}>
      {children}

      {toast && (
        <div className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[90] mx-auto max-w-md lg:bottom-6 lg:left-auto lg:right-6 lg:mx-0">
          <div
            className={`rounded-2xl border p-4 shadow-2xl backdrop-blur-xl ${
              barovia
                ? "border-[#7d3d50] bg-[#1c1016]/96 text-[#ead7dc]"
                : "border-yellow-600/40 bg-slate-950/96 text-slate-100"
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                  barovia
                    ? "bg-[#5a1825]/60 text-[#efc7d1]"
                    : "bg-yellow-500/15 text-yellow-300"
                }`}
              >
                {barovia ? "W" : "M"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{toast.message}</p>
                <Link
                  href={toast.href}
                  onClick={() => setToast(null)}
                  className={`mt-2 inline-flex text-xs font-bold ${
                    barovia ? "text-[#db91a5]" : "text-yellow-300"
                  }`}
                >
                  Open conversation →
                </Link>
              </div>
              <button
                type="button"
                onClick={() => setToast(null)}
                aria-label="Dismiss notification"
                className="px-1 text-lg leading-none opacity-60 hover:opacity-100"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}
    </CampaignChatNotificationContext.Provider>
  );
}

function useStandaloneUnreadSummary(campaignSlug: string, enabled: boolean) {
  const [summary, setSummary] = useState<UnreadSummary>({
    campaignId: null,
    unreadMessages: 0,
    unreadThreads: 0,
  });

  useEffect(() => {
    if (!enabled) return;

    let mounted = true;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function load() {
      const next = await fetchUnreadSummary(campaignSlug);
      if (!mounted) return;
      setSummary(next);

      if (!next.campaignId || channel) return;
      const filter = `campaign_id=eq.${next.campaignId}`;
      channel = supabase
        .channel(`standalone-chat-badge:${campaignSlug}:${Math.random()}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "campaign_chat_messages",
            filter,
          },
          () => void load()
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "campaign_chat_reads",
            filter,
          },
          () => void load()
        )
        .subscribe();
    }

    void load();

    return () => {
      mounted = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [campaignSlug, enabled]);

  return summary;
}

export function useCampaignChatUnread(campaignSlug: string) {
  const context = useContext(CampaignChatNotificationContext);
  const usesContext = context?.campaignSlug === campaignSlug;
  const standalone = useStandaloneUnreadSummary(campaignSlug, !usesContext);

  if (usesContext && context) {
    return {
      unreadMessages: context.unreadMessages,
      unreadThreads: context.unreadThreads,
    };
  }

  return {
    unreadMessages: standalone.unreadMessages,
    unreadThreads: standalone.unreadThreads,
  };
}

export function CampaignChatUnreadBadge({
  campaignSlug,
  theme = "nattau",
  showZero = false,
  className = "",
  label,
}: {
  campaignSlug: string;
  theme?: "nattau" | "barovia";
  showZero?: boolean;
  className?: string;
  label?: string;
}) {
  const { unreadMessages } = useCampaignChatUnread(campaignSlug);

  if (!showZero && unreadMessages <= 0) return null;

  const visibleCount = unreadMessages > 99 ? "99+" : String(unreadMessages);

  return (
    <span
      aria-label={label ?? `${unreadMessages} unread messages`}
      title={label ?? `${unreadMessages} unread messages`}
      className={`inline-flex min-w-5 items-center justify-center rounded-full border px-1.5 py-0.5 text-[10px] font-black leading-none shadow-lg ${
        theme === "barovia"
          ? "border-[#e08da3]/40 bg-[#8c2944] text-white shadow-[#5a1825]/30"
          : "border-yellow-300/40 bg-yellow-400 text-slate-950 shadow-yellow-500/20"
      } ${className}`}
    >
      {visibleCount}
    </span>
  );
}
