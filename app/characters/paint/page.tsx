import Link from "next/link";
import { redirect } from "next/navigation";
import { MiniaturePainterLab } from "@/components/miniatures/MiniaturePainterLab";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ character?: string | string[] }>;
};

export default async function PlayerMiniaturePainterPage({ searchParams }: Props) {
  const access = await requireCampaignMembership("nattau");
  if (access.membership.role === "dm") redirect("/gm/miniatures/paint");

  const params = await searchParams;
  const requestedCharacter = typeof params.character === "string" ? params.character : null;

  return (
    <main className="min-h-screen bg-[#090e15] px-4 py-7 text-slate-100 sm:px-6 lg:py-9">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-fuchsia-300">Campaign miniature studio</p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">Paint Miniatures</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
              Your own character can have as many skins as you want. You can also paint every other current campaign miniature, with one replaceable community skin slot per character. Only that character&apos;s owner or the Game Master can choose the default.
            </p>
          </div>
          <Link href="/characters" className="inline-flex min-h-11 items-center rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-300">
            ← Characters
          </Link>
        </div>

        <MiniaturePainterLab
          campaignId={access.membership.campaignId}
          currentUserId={access.userId}
          initialPlayerId={requestedCharacter ?? access.userId}
        />
      </div>
    </main>
  );
}
