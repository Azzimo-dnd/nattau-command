import Link from "next/link";
import type { AppRole } from "@/components/navigation/navigationTypes";
import { CampaignChatUnreadBadge } from "@/components/notifications/CampaignChatNotifications";

import { NextSessionCountdown } from "@/components/home/NextSessionCountdown";
import { AzzimosPricePanel } from "@/components/session/AzzimosPricePanel";
import type { CampaignSessionSettings } from "@/lib/campaign/sessionTypes";

type ModuleStatus = "active" | "preview";

const modules: Array<{
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  mark: string;
  status: ModuleStatus;
}> = [
  {
    eyebrow: "At the table", title: "Tabletop of the Mists", description: "Gather the party, reveal the fog, roll Hope and Fear and pass the spotlight.", href: "/campaigns/barovia/vtt", mark: "V", status: "active",
  },
  {
    eyebrow: "Puzzles", title: "Sealed Relics", description: "Unseal iron reliquaries, restore broken rites and answer the echoes waiting in the dark.", href: "/campaigns/barovia/puzzles", mark: "R", status: "active",
  },
  {
    eyebrow: "Scheduling",
    title: "The Gathering",
    description:
      "Mark available nights, compare the party's answers, open votes and choose the next descent into Barovia.",
    href: "/campaigns/barovia/session-planner",
    mark: "G",
    status: "active",
  },
  {
    eyebrow: "Private Messages",
    title: "Whispers Through the Mists",
    description:
      "A private channel between each player and the Game Master, with unread-message notifications carried across Barovia.",
    href: "/campaigns/barovia/whispers",
    mark: "W",
    status: "active",
  },
  {
    eyebrow: "Daggerheart Dice",
    title: "The Duality",
    description:
      "Roll Hope and Fear, reaction checks, adversary attacks and damage. Results are saved to the Barovia campaign log.",
    href: "/campaigns/barovia/dice",
    mark: "D",
    status: "active",
  },
  {
    eyebrow: "Fate",
    title: "Tarokka of the Mists",
    description:
      "A Barovian interpretation of the campaign Tarot system, with its own deck, cycle and omens.",
    href: "/campaigns/barovia/tarokka",
    mark: "T",
    status: "active",
  },
  {
    eyebrow: "Party",
    title: "Lost Souls",
    description:
      "Inspect the party's current 3D miniatures and contribute painted skins.",
    href: "/campaigns/barovia/characters",
    mark: "S",
    status: "active",
  },
  {
    eyebrow: "World",
    title: "Atlas of the Mists",
    description:
      "A discoverable map of Barovia with hidden, rumored and revealed locations.",
    href: "/campaigns/barovia/map",
    mark: "A",
    status: "active",
  },
];

export function BaroviaDashboard({
  displayName,
  role,
  session,
}: {
  displayName: string;
  role: AppRole;
  session: CampaignSessionSettings;
}) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-9 xl:px-8">
      <section className="relative overflow-hidden rounded-[30px] border border-[#713143]/55 bg-[#150e13]/90 p-6 shadow-2xl sm:p-9">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(126,35,57,0.42),transparent_36%),radial-gradient(circle_at_16%_90%,rgba(119,129,141,0.12),transparent_32%)]" />
        <div className="relative max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#884259]/50 bg-[#5a1825]/25 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#d9a0af]">
              Daggerheart
            </span>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">
              {role === "dm" ? "Game Master" : "Player"}
            </span>
          </div>

          <p className="mt-8 text-xs font-bold uppercase tracking-[0.38em] text-[#aa5b70]">
            Beyond the Mists
          </p>
          <h1 className="mt-3 font-serif text-4xl font-black text-[#efe0d5] sm:text-6xl">
            Welcome to Barovia, {displayName}
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-[#b8adb1] sm:text-base">
            A lantern burns beside the road. Gather those who can answer its light; the Mists will keep the others until their story resumes.
          </p>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2" aria-label="Next gathering">
        <NextSessionCountdown status={session.status} target={session.nextSessionAt} message={session.message} />
        <div className="rounded-2xl border border-[#4c2934] bg-[#150e13] p-5">
          <p className="font-serif text-xl font-bold text-[#e8d8ce]">Before the lanterns are lit</p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-[#dfacbd]">
            <Link href="/campaigns/barovia/session-planner">Share availability →</Link>
            <Link href="/campaigns/barovia/tarokka">Read your omen →</Link>
            {role === "dm" && <><Link href="/campaigns/barovia/gm/session">Announce the gathering →</Link><Link href="/campaigns/barovia/gm/members">Invite the party →</Link><Link href="/campaigns/barovia/gm/puzzles">Prepare a relic →</Link></>}
          </div>
        </div>
      </section>
      <div className="mt-4"><AzzimosPricePanel campaignSlug="barovia" debuffs={session.debuffs} /></div>

      <section className="mt-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-[#9f5367]">
              Campaign Modules
            </p>
            <h2 className="mt-2 font-serif text-3xl font-black text-[#e8d8ce]">
              Tools within the fog
            </h2>
          </div>
          <span className="rounded-full border border-[#713143]/50 bg-[#35151f]/40 px-3 py-1 text-xs text-[#c48c9b]">
            {modules.filter((module) => module.status === "active").length} active modules
          </span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {modules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="group relative min-h-52 overflow-hidden rounded-3xl border border-[#4c2934] bg-[#120d11]/90 p-5 transition hover:-translate-y-0.5 hover:border-[#87445a] sm:p-6"
            >
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(91,24,38,0.18),transparent_56%)]" />
              <div className="relative flex h-full gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#884259]/50 bg-[#5a1825]/25 font-serif text-lg font-black text-[#e0b5c0]">
                  {module.mark}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#9f5367]">
                      {module.eyebrow}
                    </p>
                    <span className="flex items-center gap-2">
                      {module.href === "/campaigns/barovia/whispers" && (
                        <CampaignChatUnreadBadge
                          campaignSlug="barovia"
                          theme="barovia"
                        />
                      )}
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] ${
                          module.status === "active"
                            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                            : "border-[#5b414a] bg-black/20 text-[#8f7d83]"
                        }`}
                      >
                        {module.status === "active" ? "Active" : "Preview"}
                      </span>
                    </span>
                  </div>
                  <h3 className="mt-2 font-serif text-2xl font-black text-[#eadbd2]">
                    {module.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[#a9a0a4]">
                    {module.description}
                  </p>
                  <span className="mt-auto pt-5 text-sm font-bold text-[#cf8fa1] transition group-hover:text-[#e5b1be]">
                    {module.status === "active" ? "Open module" : "Open preview"} →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
