import Link from "next/link";
import { NavIcon } from "@/components/navigation/NavIcon";
import type { ChronicleEntry } from "@/lib/chronicle/types";

type RecentCampaignEventsProps = {
  events: ChronicleEntry[];
  heading?: string;
  isDm?: boolean;
};

export function RecentCampaignEvents({ events, heading = "Recent Events", isDm = false }: RecentCampaignEventsProps) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-yellow-500">Campaign Chronicle</p>
          <h2 className="mt-2 text-2xl font-black text-slate-100">{heading}</h2>
        </div>
        <NavIcon name="history" className="h-6 w-6 text-slate-600" />
      </div>
      <div className="mt-5 divide-y divide-slate-800">
        {events.length === 0 && <p className="py-5 text-sm text-slate-500">No events recorded yet.</p>}
        {events.map(event => (
          <article key={event.id} className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">{event.title}</h3>
                <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-400">{event.description}</p>
              </div>
              <span className="shrink-0 rounded-full border border-slate-700 bg-slate-950/50 px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-slate-400">{event.tag}</span>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-800 pt-4">
        <Link href="/campaigns/nattau/chronicle"
          className="inline-flex min-h-10 items-center rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-200 transition hover:border-yellow-600/50">
          View full Chronicle
        </Link>
        {isDm && (
          <Link href="/campaigns/nattau/gm/chronicle"
            className="inline-flex min-h-10 items-center rounded-xl border border-yellow-600/30 bg-yellow-500/10 px-4 text-sm font-semibold text-yellow-200 transition hover:bg-yellow-500/20">
            Edit Chronicle
          </Link>
        )}
      </div>
    </section>
  );
}
