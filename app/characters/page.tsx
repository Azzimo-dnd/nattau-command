import Link from "next/link";
import { CharacterMiniaturesGallery } from "@/components/miniatures/CharacterMiniaturesGallery";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export const dynamic = "force-dynamic";

export default async function CharactersPage() {
  const access = await requireCampaignMembership("nattau");
  const isDm = access.membership.role === "dm";

  return (
    <main className="min-h-screen bg-[#090e15] px-4 py-7 text-slate-100 sm:px-6 lg:py-9">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 overflow-hidden rounded-[30px] border border-slate-800 bg-[radial-gradient(circle_at_top_left,#263249_0%,#111925_55%,#090e16_100%)] p-6 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.32em] text-yellow-500">Expedition roster</p>
              <h1 className="mt-3 text-4xl font-black sm:text-5xl">Characters</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                Browse current miniatures and their paint skins. Players may contribute one replaceable skin to another character while keeping unlimited skins for their own; only the Game Master or the character owner decides the default.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isDm ? (
                <Link href="/gm/miniatures" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-yellow-500 px-5 font-black text-slate-950">
                  Manage Miniatures
                </Link>
              ) : (
                <Link href="/characters/paint" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/10 px-5 font-black text-fuchsia-100">
                  Paint Miniatures
                </Link>
              )}
            </div>
          </div>
        </header>

        <CharacterMiniaturesGallery
          campaignId={access.membership.campaignId}
          currentUserId={access.userId}
          isDm={isDm}
          preferredPlayerId={access.membership.role === "player" ? access.userId : null}
        />
      </div>
    </main>
  );
}
