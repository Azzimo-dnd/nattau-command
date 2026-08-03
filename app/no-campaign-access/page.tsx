import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "No Campaign Access",
};

export default function NoCampaignAccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <section className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900/90 p-6 text-center shadow-2xl sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-slate-500">
          Campaign Companion
        </p>
        <h1 className="mt-4 text-3xl font-black">No campaign assigned</h1>
        <p className="mt-4 text-sm leading-6 text-slate-400">
          Your account is active, but it has not been added to a campaign yet.
          Contact the Game Master who invited you.
        </p>
        <Link
          href="/account"
          className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-5 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
        >
          Open account
        </Link>
      </section>
    </main>
  );
}
