import Link from "next/link";
import { redirect } from "next/navigation";
import { SessionControls } from "@/components/gm/SessionControls";
import { getCurrentAppUser } from "@/lib/auth/getCurrentAppUser";
import { loadCampaignSessionSettings } from "@/lib/campaign/sessionSettings";

export default async function SessionControlsPage() {
  const currentUser = await getCurrentAppUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (currentUser.role !== "dm") {
    redirect("/");
  }

  const settings = await loadCampaignSessionSettings();

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 text-slate-100 sm:px-6 xl:px-8">
      <Link
        href="/"
        className="inline-flex rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-slate-300 transition hover:border-yellow-600/40 hover:text-yellow-300"
      >
        ← Back to Command Center
      </Link>

      <div className="mt-6">
        <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
          Game Master Control
        </p>
        <h1 className="mt-3 text-4xl font-black md:text-5xl">
          Next Session
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Control the date displayed to every expedition member without editing
          source code or redeploying the application.
        </p>
      </div>

      <div className="mt-8">
        <SessionControls initialSettings={settings} />
      </div>
    </main>
  );
}
