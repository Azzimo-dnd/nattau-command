import Link from "next/link";
import { ResourceDashboard } from "@/components/resources/ResourceDashboard";

export default function ResourcesPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 text-slate-100">
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-slate-300 transition hover:border-yellow-600/40 hover:text-yellow-300"
        >
          ← Back to Command Center
        </Link>

        <div className="mt-6">
          <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
            Settlement Logistics
          </p>

          <h1 className="mt-3 text-4xl font-bold">Resource Production</h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Monthly resource output, food production and strategic supply status
            of the settlement.
          </p>
        </div>
      </div>

      <ResourceDashboard />
    </main>
  );
}