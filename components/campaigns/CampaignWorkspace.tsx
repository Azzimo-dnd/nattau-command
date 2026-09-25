import Link from "next/link";
import type { ReactNode } from "react";
import { campaignPresentation, type SupportedCampaign } from "@/lib/campaigns/campaignPresentation";
import styles from "./CampaignWorkspace.module.css";

export function CampaignWorkspace({ campaignSlug, title, description, children, actions, compact = false }: {
  campaignSlug: SupportedCampaign;
  title: string;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
}) {
  const theme = campaignPresentation(campaignSlug);
  return (
    <main className={`${styles.workspace} ${theme.barovia ? styles.barovia : ""} min-h-screen px-3 py-5 text-slate-100 sm:px-6 lg:py-7`}>
      <div className="mx-auto max-w-[1800px]">
        <header
          className={`${styles.header} border ${
            compact
              ? "mb-4 rounded-2xl p-4 sm:p-5"
              : "mb-5 rounded-[30px] p-5 sm:p-8"
          }`}
        >
          <Link href={theme.home} className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400 hover:text-slate-100">← {theme.homeLabel}</Link>
          <div
            className={`${
              compact ? "mt-3 gap-3" : "mt-5 gap-5"
            } flex flex-col justify-between lg:flex-row lg:items-end`}
          >
            <div className="max-w-3xl">
              <h1
                className={`${theme.barovia ? "font-serif" : ""} ${
                  compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-5xl"
                } font-black`}
              >
                {title}
              </h1>
              <p
                className={`${
                  compact ? "mt-2 leading-6" : "mt-4 leading-7"
                } max-w-2xl text-sm text-slate-400`}
              >
                {description}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">{actions}</div>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}

export function WorkspaceLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-flex min-h-11 items-center rounded-xl border border-slate-600/60 bg-black/20 px-4 text-sm font-bold text-slate-200 transition hover:border-rose-300/60 hover:text-white">{children}</Link>;
}
