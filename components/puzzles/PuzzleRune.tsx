import { getCampaignRuneDefinition } from "@/lib/puzzles/campaignRunes";

export function PuzzleRune({ rune, label = false, className = "" }: { rune?: string | null; label?: boolean; className?: string }) {
  const definition = rune ? getCampaignRuneDefinition(rune) : null;
  return <span className={`inline-flex h-full w-full flex-col items-center justify-center ${className}`} title={definition?.title}>
    {definition ? <svg viewBox="0 0 24 24" className="h-[1em] w-[1em] shrink-0" role="img" aria-label={definition.label} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{definition.paths.map((path) => <path key={path} d={path} />)}</svg> : <span>{rune ?? "·"}</span>}
    {label && definition && <span className="mt-1 text-[10px] font-bold uppercase tracking-wide">{definition.label}</span>}
  </span>;
}
