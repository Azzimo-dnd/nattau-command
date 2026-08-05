import Link from "next/link";
import type { CampaignMembership } from "@/lib/campaigns/campaignTypes";
import { CampaignChatUnreadBadge } from "@/components/notifications/CampaignChatNotifications";

function CampaignCard({ campaign }: { campaign: CampaignMembership }) {
  const isBarovia = campaign.themeKey === "barovia";

  return (
    <Link
      href={campaign.homeHref}
      className={`group relative min-h-[270px] overflow-hidden rounded-[28px] border p-6 shadow-2xl transition duration-300 hover:-translate-y-1 sm:p-8 ${
        isBarovia
          ? "border-[#713143]/60 bg-[#160e13] hover:border-[#a34a61]"
          : "border-yellow-600/30 bg-slate-900 hover:border-yellow-500/60"
      }`}
    >
      <div
        className={`pointer-events-none absolute inset-0 opacity-80 ${
          isBarovia
            ? "bg-[radial-gradient(circle_at_top_right,rgba(120,29,52,0.45),transparent_46%),linear-gradient(145deg,transparent,rgba(8,7,10,0.92))]"
            : "bg-[radial-gradient(circle_at_top_right,rgba(234,179,8,0.18),transparent_46%),linear-gradient(145deg,transparent,rgba(2,6,23,0.92))]"
        }`}
      />

      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <span
            className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
              isBarovia
                ? "border-[#854056]/50 bg-[#5a1825]/30 text-[#e0b8c1]"
                : "border-yellow-600/30 bg-yellow-500/10 text-yellow-300"
            }`}
          >
            {campaign.systemKey === "daggerheart" ? "Daggerheart" : "D&D 5e"}
          </span>

          <div className="flex items-center gap-2">
            <CampaignChatUnreadBadge
              campaignSlug={campaign.slug}
              theme={isBarovia ? "barovia" : "nattau"}
            />
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
              {campaign.role === "dm" ? "Game Master" : "Player"}
            </span>
          </div>
        </div>

        <div className="mt-auto pt-14">
          <p
            className={`text-xs font-bold uppercase tracking-[0.35em] ${
              isBarovia ? "text-[#b56a7e]" : "text-yellow-500"
            }`}
          >
            {campaign.subtitle}
          </p>
          <h2
            className={`mt-3 font-serif text-3xl font-black sm:text-4xl ${
              isBarovia ? "text-[#ead9ce]" : "text-slate-100"
            }`}
          >
            {campaign.companionName}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            {isBarovia
              ? "Cross the threshold and continue the story beyond the mists."
              : "Return to the Kainite expedition and its command center."}
          </p>

          <span
            className={`mt-6 inline-flex items-center gap-2 text-sm font-bold transition group-hover:gap-3 ${
              isBarovia ? "text-[#d79aac]" : "text-yellow-300"
            }`}
          >
            Enter campaign <span aria-hidden>→</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

export function CampaignSelector({
  displayName,
  campaigns,
}: {
  displayName: string;
  campaigns: CampaignMembership[];
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07090e] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(234,179,8,0.08),transparent_30%),radial-gradient(circle_at_86%_18%,rgba(120,29,52,0.17),transparent_32%)]" />

      <div className="relative mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.38em] text-slate-500">
              Campaign Companion
            </p>
            <h1 className="mt-4 max-w-3xl font-serif text-4xl font-black tracking-tight sm:text-5xl">
              Where does the story continue?
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              Welcome, {displayName}. Only campaigns assigned to your account are
              shown here.
            </p>
          </div>

          <Link
            href="/account"
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-700 bg-slate-900/70 px-4 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            Account
          </Link>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.campaignId} campaign={campaign} />
          ))}
        </div>
      </div>
    </main>
  );
}
