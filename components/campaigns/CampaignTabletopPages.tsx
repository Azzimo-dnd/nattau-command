import { redirect } from "next/navigation";
import { CharacterMiniaturesGallery } from "@/components/miniatures/CharacterMiniaturesGallery";
import { MiniatureManager } from "@/components/miniatures/MiniatureManager";
import { MiniaturePainterLab } from "@/components/miniatures/MiniaturePainterLab";
import { VttBattleBoard } from "@/components/vtt/VttBattleBoard";
import { VttObjectUrlGuard } from "@/components/vtt/VttObjectUrlGuard";
import { VttThreeMaterialPatch } from "@/components/vtt/VttThreeMaterialPatch";
import { VttEnemyStudio } from "@/components/vtt/VttEnemyStudio";
import { VttEnemyPainter } from "@/components/vtt/VttEnemyPainter";
import { SessionControls } from "@/components/gm/SessionControls";
import { loadCampaignSessionSettings } from "@/lib/campaign/sessionSettings";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";
import { campaignPath, campaignPresentation, type SupportedCampaign } from "@/lib/campaigns/campaignPresentation";
import { CampaignWorkspace, WorkspaceLink } from "./CampaignWorkspace";

type Props = { campaignSlug: SupportedCampaign };

export async function CampaignTabletopPage({ campaignSlug }: Props) {
  const access = await requireCampaignMembership(campaignSlug);
  const theme = campaignPresentation(campaignSlug);
  const isDm = access.membership.role === "dm";
  return (
    <CampaignWorkspace campaignSlug={campaignSlug} title={theme.tabletop}
      description={theme.barovia ? "Lanterns against the dark. Reveal the road one clearing at a time, share Hope and Fear, and pass the spotlight as the story demands." : "Unroll the expedition's maps, gather the company and take the field. Shared miniatures, physical dice and a tabletop directed by the Game Master."}
      actions={<>{isDm && <WorkspaceLink href={campaignPath(campaignSlug, "/gm/vtt/enemies")}>{theme.enemies}</WorkspaceLink>}<WorkspaceLink href={campaignPath(campaignSlug, "/characters")}>{theme.characters}</WorkspaceLink></>}>
      <VttObjectUrlGuard /><VttThreeMaterialPatch />
      <VttBattleBoard key={access.membership.campaignId} campaignId={access.membership.campaignId} campaignSlug={campaignSlug} isDm={isDm} currentUserId={access.userId} currentUserName={access.displayName} />
    </CampaignWorkspace>
  );
}

export async function CampaignCharactersPage({ campaignSlug }: Props) {
  const access = await requireCampaignMembership(campaignSlug);
  const theme = campaignPresentation(campaignSlug);
  const isDm = access.membership.role === "dm";
  return (
    <CampaignWorkspace campaignSlug={campaignSlug} title={theme.characters}
      description={theme.barovia ? "Faces the Mists have not yet taken. Inspect the party's miniatures and choose the colours they carry into the dark." : "Meet the expedition through its current miniatures. Inspect models, contribute paint skins and choose your character's appearance."}
      actions={<><WorkspaceLink href={campaignPath(campaignSlug, isDm ? "/gm/miniatures" : "/characters/paint")}>{isDm ? "Manage miniatures" : "Paint miniatures"}</WorkspaceLink><WorkspaceLink href={campaignPath(campaignSlug, "/vtt")}>Open tabletop</WorkspaceLink></>}>
      <CharacterMiniaturesGallery key={access.membership.campaignId} campaignId={access.membership.campaignId} campaignSlug={campaignSlug} currentUserId={access.userId} isDm={isDm} preferredPlayerId={access.membership.role === "player" ? access.userId : null} />
    </CampaignWorkspace>
  );
}

export async function CampaignMiniatureStudioPage({ campaignSlug }: Props) {
  const access = await requireCampaignMembership(campaignSlug);
  if (access.membership.role !== "dm") redirect(access.membership.homeHref);
  return <CampaignWorkspace campaignSlug={campaignSlug} title="Character Miniatures" description="Assign models to this campaign's active players. Choose the current miniature before placing the party on the tabletop."
    actions={<><WorkspaceLink href={campaignPath(campaignSlug, "/gm/miniatures/paint")}>Paint miniatures</WorkspaceLink><WorkspaceLink href={campaignPath(campaignSlug, "/characters")}>View party</WorkspaceLink></>}>
    <MiniatureManager key={access.membership.campaignId} campaignId={access.membership.campaignId} />
  </CampaignWorkspace>;
}

export async function CampaignMiniaturePaintPage({ campaignSlug, gm = false, character }: Props & { gm?: boolean; character?: string }) {
  const access = await requireCampaignMembership(campaignSlug);
  const isDm = access.membership.role === "dm";
  if (gm && !isDm) redirect(access.membership.homeHref);
  if (!gm && isDm) redirect(campaignPath(campaignSlug, "/gm/miniatures/paint"));
  return <CampaignWorkspace campaignSlug={campaignSlug} title="Miniature Painter" description="Paint your own miniature or contribute a skin to another member of the party. The owner or Game Master chooses the default appearance."
    actions={<WorkspaceLink href={campaignPath(campaignSlug, "/characters")}>View party</WorkspaceLink>}>
    <MiniaturePainterLab key={access.membership.campaignId} campaignId={access.membership.campaignId} currentUserId={access.userId} isDm={isDm} initialPlayerId={character ?? (isDm ? null : access.userId)} />
  </CampaignWorkspace>;
}

export async function CampaignEnemyStudioPage({ campaignSlug, paint = false, model }: Props & { paint?: boolean; model?: string }) {
  const access = await requireCampaignMembership(campaignSlug);
  if (access.membership.role !== "dm") redirect(access.membership.homeHref);
  return <CampaignWorkspace campaignSlug={campaignSlug} title={paint ? "Enemy Painter" : campaignPresentation(campaignSlug).enemies}
    description="Prepare and paint the creatures waiting beyond the party's sight. The Game Master controls when each miniature is revealed."
    actions={<><WorkspaceLink href={campaignPath(campaignSlug, "/vtt")}>Open tabletop</WorkspaceLink>{paint && <WorkspaceLink href={campaignPath(campaignSlug, "/gm/vtt/enemies")}>Enemy studio</WorkspaceLink>}</>}>
    {paint ? <VttEnemyPainter key={access.membership.campaignId} campaignId={access.membership.campaignId} initialModelId={model ?? null} /> : <VttEnemyStudio key={access.membership.campaignId} campaignId={access.membership.campaignId} campaignSlug={campaignSlug} />}
  </CampaignWorkspace>;
}

export async function CampaignSessionPage({ campaignSlug }: Props) {
  const access = await requireCampaignMembership(campaignSlug);
  if (access.membership.role !== "dm") redirect(access.membership.homeHref);
  const settings = await loadCampaignSessionSettings(access.membership.campaignId);
  return <CampaignWorkspace campaignSlug={campaignSlug} title={campaignSlug === "barovia" ? "The Next Gathering" : "Next Session"}
    description="Publish the next session date and a message for this campaign's players. Times are entered in your local time zone."
    actions={<WorkspaceLink href={campaignPath(campaignSlug, "/session-planner")}>Check availability</WorkspaceLink>}>
    <SessionControls key={access.membership.campaignId} initialSettings={settings} campaignSlug={campaignSlug} />
  </CampaignWorkspace>;
}
