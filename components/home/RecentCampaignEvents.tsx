import { NavIcon } from "@/components/navigation/NavIcon";
import type { CampaignEvent } from "@/config/campaign";

type RecentCampaignEventsProps = {
  events: CampaignEvent[];
};

export function RecentCampaignEvents({ events }: RecentCampaignEventsProps) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-yellow-500">
            Campaign Chronicle
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-100">
            Recent Events
          </h2>
        </div>
        <NavIcon name="history" className="h-6 w-6 text-slate-600" />
      </div>

      <div className="mt-5 divide-y divide-slate-800">
        {events.map((event) => (
          <article key={event.title} className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  {event.title}
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {event.description}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-slate-700 bg-slate-950/50 px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-slate-400">
                {event.tag}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
