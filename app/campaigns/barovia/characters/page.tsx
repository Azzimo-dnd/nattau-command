import { CharacterMiniaturesGallery } from "@/components/miniatures/CharacterMiniaturesGallery";
import { DaggerheartCharacterSheets } from "@/components/daggerheart/DaggerheartCharacterSheets";
import { CampaignWorkspace, WorkspaceLink } from "@/components/campaigns/CampaignWorkspace";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export const dynamic = "force-dynamic";

export default async function Page() {
  const access = await requireCampaignMembership("barovia");
  const isDm = access.membership.role === "dm";

  return (
    <CampaignWorkspace
      campaignSlug="barovia"
      title="Lost Souls"
      description="Create and maintain the party's full Daggerheart character sheets. Core Rulebook and Hope & Fear options live here beside the miniatures carried through the Mists."
      actions={
        <>
          {isDm && (
            <WorkspaceLink href="/campaigns/barovia/gm/miniatures">
              Manage miniatures
            </WorkspaceLink>
          )}
          <WorkspaceLink href="/campaigns/barovia/vtt">Open tabletop</WorkspaceLink>
        </>
      }
    >
      <DaggerheartCharacterSheets
        campaignId={access.membership.campaignId}
        currentUserId={access.userId}
        isDm={isDm}
      />

      <section className="mt-8">
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#875765]">
            Tabletop appearance
          </p>
          <h2 className="mt-2 font-serif text-2xl font-black text-[#ead7dc]">
            Miniatures
          </h2>
        </div>
        <CharacterMiniaturesGallery
          key={access.membership.campaignId}
          campaignId={access.membership.campaignId}
          campaignSlug="barovia"
          currentUserId={access.userId}
          isDm={isDm}
          preferredPlayerId={access.membership.role === "player" ? access.userId : null}
        />
      </section>
    </CampaignWorkspace>
  );
}
