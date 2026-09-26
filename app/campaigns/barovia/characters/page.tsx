import type { Metadata } from "next";
import Link from "next/link";
import { DaggerheartCharacterSheets } from "@/components/daggerheart/DaggerheartCharacterSheets";
import { CharacterMiniaturesGallery } from "@/components/miniatures/CharacterMiniaturesGallery";
import {
  CampaignWorkspace,
  WorkspaceLink,
} from "@/components/campaigns/CampaignWorkspace";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export const metadata: Metadata = { title: "Player Hub" };

export const dynamic = "force-dynamic";

const playerLinks = [
  {
    href: "#character-sheet",
    eyebrow: "At the table",
    title: "Character Sheet",
    description: "Live Daggerheart resources, traits, weapons, actions and dice rolls.",
  },
  {
    href: "#miniature",
    eyebrow: "Your figure",
    title: "Miniature",
    description: "Preview your current 3D miniature and its painted skins.",
  },
  {
    href: "/campaigns/barovia/session-planner",
    eyebrow: "Scheduling",
    title: "The Gathering",
    description: "Share your availability and vote on the next session.",
  },
  {
    href: "/campaigns/barovia/whispers",
    eyebrow: "Private",
    title: "Whispers",
    description: "Your private conversation with the Game Master.",
  },
  {
    href: "/campaigns/barovia/tarokka",
    eyebrow: "Fate",
    title: "Tarokka",
    description: "Return to your omen and the current cycle of the Mists.",
  },
];

export default async function Page() {
  const access = await requireCampaignMembership("barovia");
  const isDm = access.membership.role === "dm";

  if (isDm) {
    return (
      <CampaignWorkspace
        campaignSlug="barovia"
        title="Character Sheet"
        description="Inspect the party's Daggerheart play sheets and live table state. Character creation and management remain in the separate GM workspace."
        actions={
          <>
            <WorkspaceLink href="/campaigns/barovia/characters/manage">
              Character manager
            </WorkspaceLink>
            <WorkspaceLink href="/campaigns/barovia/compendium">
              Open compendium
            </WorkspaceLink>
            <WorkspaceLink href="/campaigns/barovia/vtt">
              Open tabletop
            </WorkspaceLink>
          </>
        }
      >
        <DaggerheartCharacterSheets
          campaignId={access.membership.campaignId}
          currentUserId={access.userId}
          isDm
          mode="play"
        />
      </CampaignWorkspace>
    );
  }

  return (
    <CampaignWorkspace
      campaignSlug="barovia"
      title="Player Hub"
      description={`Everything you need at the table, ${access.displayName}: your character sheet, miniature and the player-facing tools of Beyond the Mists.`}
      actions={
        <>
          <WorkspaceLink href="/campaigns/barovia/vtt">
            Open tabletop
          </WorkspaceLink>
          <WorkspaceLink href="/campaigns/barovia/session-planner">
            Session planner
          </WorkspaceLink>
        </>
      }
    >
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Player shortcuts">
        {playerLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-2xl border border-[#482b35] bg-[#130d11]/85 p-4 transition hover:-translate-y-0.5 hover:border-[#87445a] hover:bg-[#1a1015]"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9f5367]">
              {item.eyebrow}
            </p>
            <h2 className="mt-2 font-serif text-lg font-black text-[#eadbd2]">
              {item.title}
            </h2>
            <p className="mt-2 text-xs leading-5 text-[#98888e]">
              {item.description}
            </p>
            <span className="mt-3 inline-block text-xs font-bold text-[#cf8fa1] transition group-hover:text-[#efb8c6]">
              Open →
            </span>
          </Link>
        ))}
      </section>

      <section id="character-sheet" className="mt-6 scroll-mt-24">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9f5367]">
              Your character
            </p>
            <h2 className="mt-1 font-serif text-2xl font-black text-[#eadbd2]">
              Play Sheet
            </h2>
          </div>
          <Link
            href="/campaigns/barovia/compendium"
            className="text-xs font-bold text-[#c68a9b] transition hover:text-[#efb8c6]"
          >
            Open compendium →
          </Link>
        </div>
        <DaggerheartCharacterSheets
          campaignId={access.membership.campaignId}
          currentUserId={access.userId}
          isDm={false}
          mode="play"
        />
      </section>

      <section id="miniature" className="mt-8 scroll-mt-24">
        <div className="mb-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9f5367]">
            Tabletop identity
          </p>
          <h2 className="mt-1 font-serif text-2xl font-black text-[#eadbd2]">
            Your Miniature
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#98888e]">
            Your current miniature is selected automatically. You can inspect skins here and open the painter without leaving your player space.
          </p>
        </div>
        <CharacterMiniaturesGallery
          campaignId={access.membership.campaignId}
          campaignSlug="barovia"
          currentUserId={access.userId}
          isDm={false}
          preferredPlayerId={access.userId}
        />
      </section>
    </CampaignWorkspace>
  );
}
