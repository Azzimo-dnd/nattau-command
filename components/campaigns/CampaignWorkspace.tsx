import Link from "next/link";
import type { ReactNode } from "react";
import { campaignPresentation, type SupportedCampaign } from "@/lib/campaigns/campaignPresentation";
import styles from "./CampaignWorkspace.module.css";

export function CampaignWorkspace({ campaignSlug, title, description, children, actions }: {
  campaignSlug: SupportedCampaign;
  title: string;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const theme = campaignPresentation(campaignSlug);
  return (
    <main className={`${styles.workspace} ${theme.barovia ? styles.barovia : ""} min-h-screen px-3 py-5 text-slate-100 sm:px-6 lg:py-7`}>
      <div className="mx-auto max-w-[1800px]">
        <header className={`${styles.header} mb-5 rounded-[30px] border p-5 sm:p-8`}>
          <Link href={theme.home} className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400 hover:text-slate-100">← {theme.homeLabel}</Link>
          <div className="mt-5 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <h1 className={`${theme.barovia ? "font-serif" : ""} text-3xl font-black sm:text-5xl`}>{title}</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">{description}</p>
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
