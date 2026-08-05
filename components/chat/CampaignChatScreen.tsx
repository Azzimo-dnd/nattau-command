import Link from "next/link";
import { CampaignChatWindow } from "./CampaignChatWindow";
import type {
  CampaignChatTheme,
  CampaignChatThreadData,
  CampaignChatThreadSummary,
} from "./campaignChatTypes";

function formatRelativeTime(value: string | null) {
  if (!value) return "No messages yet";

  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60000));

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function compactPreview(value: string | null) {
  if (!value) return "Private channel ready.";
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 72 ? `${normalized.slice(0, 69)}...` : normalized;
}

export function CampaignChatScreen({
  theme,
  role,
  title,
  eyebrow,
  description,
  backHref,
  backLabel,
  searchParamName,
  summaries,
  selectedPlayerId,
  thread,
}: {
  theme: CampaignChatTheme;
  role: "dm" | "player";
  title: string;
  eyebrow: string;
  description: string;
  backHref: string;
  backLabel: string;
  searchParamName: string;
  summaries: CampaignChatThreadSummary[];
  selectedPlayerId: string | null;
  thread: CampaignChatThreadData | null;
}) {
  const barovia = theme === "barovia";

  return (
    <main
      className={`mx-auto min-h-screen px-4 py-6 sm:px-6 sm:py-8 xl:px-8 ${
        role === "dm" ? "max-w-[1500px]" : "max-w-5xl"
      }`}
    >
      <Link
        href={backHref}
        className={`inline-flex min-h-11 items-center rounded-xl border px-4 py-2 text-sm transition ${
          barovia
            ? "border-[#51303c] bg-black/25 text-[#bda5ad] hover:border-[#8f4057] hover:text-[#ebc9d2]"
            : "border-slate-700 bg-slate-950/70 text-slate-300 hover:border-yellow-600/40 hover:text-yellow-300"
        }`}
      >
        ← {backLabel}
      </Link>

      <div className="mt-6">
        <p
          className={`text-xs uppercase tracking-[0.35em] ${
            barovia ? "text-[#a7566d]" : "text-yellow-500"
          }`}
        >
          {eyebrow}
        </p>
        <h1
          className={`mt-3 font-serif text-4xl font-black md:text-5xl ${
            barovia ? "text-[#ead7dc]" : "text-slate-100"
          }`}
        >
          {title}
        </h1>
        <p
          className={`mt-3 max-w-3xl text-sm leading-6 ${
            barovia ? "text-[#a9929a]" : "text-slate-400"
          }`}
        >
          {description}
        </p>
      </div>

      {role === "dm" ? (
        summaries.length === 0 ? (
          <div
            className={`mt-7 rounded-2xl border p-6 text-sm ${
              barovia
                ? "border-[#4b2935] bg-[#130d11] text-[#9b878e]"
                : "border-slate-800 bg-slate-900 text-slate-400"
            }`}
          >
            No active player accounts are assigned to this campaign.
          </div>
        ) : (
          <div className="mt-7 grid gap-6 lg:grid-cols-[330px_minmax(0,1fr)]">
            <aside
              className={`h-fit rounded-3xl border p-3 lg:sticky lg:top-6 ${
                barovia
                  ? "border-[#4b2935] bg-[#120c10]/92"
                  : "border-slate-800 bg-slate-900"
              }`}
            >
              <div className="px-2 py-2">
                <p
                  className={`text-[10px] font-bold uppercase tracking-[0.28em] ${
                    barovia ? "text-[#9f5367]" : "text-yellow-500"
                  }`}
                >
                  {barovia ? "Souls in the fog" : "Expedition members"}
                </p>
                <p
                  className={`mt-2 text-xs leading-5 ${
                    barovia ? "text-[#7e6b72]" : "text-slate-500"
                  }`}
                >
                  Conversations with unread messages rise to the top.
                </p>
              </div>

              <nav className="mt-2 max-h-[680px] space-y-2 overflow-y-auto pr-1">
                {summaries.map((summary) => {
                  const selected = summary.playerId === selectedPlayerId;
                  const href = `?${searchParamName}=${encodeURIComponent(
                    summary.playerId
                  )}`;

                  return (
                    <Link
                      key={summary.playerId}
                      href={href}
                      className={`block rounded-2xl border p-3 transition ${
                        barovia
                          ? selected
                            ? "border-[#8a4258] bg-[#5a1825]/24"
                            : "border-[#3e2730] bg-black/20 hover:border-[#6f3749]"
                          : selected
                            ? "border-yellow-500/45 bg-yellow-500/10"
                            : "border-slate-800 bg-slate-950/55 hover:border-yellow-600/30"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border font-black ${
                            barovia
                              ? "border-[#6c3547] bg-[#5a1825]/25 text-[#dfadba]"
                              : "border-slate-700 bg-slate-900 text-slate-300"
                          }`}
                        >
                          {summary.playerDisplayName.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span
                              className={`truncate text-sm font-bold ${
                                barovia ? "text-[#dfd0d4]" : "text-slate-200"
                              }`}
                            >
                              {summary.playerDisplayName}
                            </span>
                            {summary.unreadMessages > 0 && (
                              <span
                                className={`inline-flex min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                                  barovia
                                    ? "bg-[#8c2944] text-white"
                                    : "bg-yellow-400 text-slate-950"
                                }`}
                              >
                                {summary.unreadMessages > 99
                                  ? "99+"
                                  : summary.unreadMessages}
                              </span>
                            )}
                          </span>
                          <span
                            className={`mt-1 block truncate text-xs ${
                              barovia ? "text-[#806c73]" : "text-slate-500"
                            }`}
                          >
                            {compactPreview(summary.lastMessage)}
                          </span>
                          <span
                            className={`mt-2 block text-[10px] uppercase tracking-[0.12em] ${
                              barovia ? "text-[#674f58]" : "text-slate-600"
                            }`}
                          >
                            {formatRelativeTime(summary.lastMessageAt)}
                          </span>
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </aside>

            {thread ? (
              <CampaignChatWindow
                threadId={thread.threadId}
                currentUser={thread.currentUser}
                otherParticipant={thread.otherParticipant}
                initialMessages={thread.messages}
                initialOtherLastReadAt={thread.otherLastReadAt}
                theme={theme}
              />
            ) : null}
          </div>
        )
      ) : thread ? (
        <div className="mt-7">
          <CampaignChatWindow
            threadId={thread.threadId}
            currentUser={thread.currentUser}
            otherParticipant={thread.otherParticipant}
            initialMessages={thread.messages}
            initialOtherLastReadAt={thread.otherLastReadAt}
            theme={theme}
          />
        </div>
      ) : null}
    </main>
  );
}
