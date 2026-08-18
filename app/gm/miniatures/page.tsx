import Link from "next/link";
import { redirect } from "next/navigation";
import { MiniatureViewer } from "@/components/miniatures/MiniatureViewer";
import { requireCampaignMembership } from "@/lib/campaigns/requireCampaignMembership";

export const dynamic = "force-dynamic";

export default async function MiniatureLabPage() {
  const access = await requireCampaignMembership("nattau");
  if (access.membership.role !== "dm") redirect(access.membership.homeHref);

  return (
    <main className="min-h-screen bg-[#090e15] px-4 py-7 text-slate-100 sm:px-6 lg:py-9">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-yellow-500">GM prototype lab</p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">Character Miniatures</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              A first-pass 3D miniature viewer inspired by the simple orbit / zoom workflow used by web miniature creators. For now it stays separate from character profiles so we can judge loading speed, mobile controls and presentation before wiring permanent models into the campaign.
            </p>
          </div>
          <Link href="/" className="inline-flex min-h-11 items-center rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-300">
            ← Command Center
          </Link>
        </div>

        <MiniatureViewer />
      </div>
    </main>
  );
}
