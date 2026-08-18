"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { buildPuzzlePreset } from "@/lib/puzzles/puzzlePresets";
import {
  PUZZLE_TYPE_LABELS,
  type CampaignPuzzleRow,
  type JsonRecord,
  type PuzzlePreset,
  type PuzzleTheme,
  type PuzzleType,
} from "@/lib/puzzles/puzzleTypes";
import { usePuzzleVault } from "./usePuzzleVault";

type Props = {
  campaignId: string;
  campaignSlug: string;
  theme?: PuzzleTheme;
};

type EditorState = {
  id: string | null;
  type: PuzzleType;
  title: string;
  description: string;
  difficulty: string;
  moveLimit: string;
  attemptLimit: string;
  timeLimit: string;
  failureMessage: string;
  sortOrder: string;
  publicConfig: string;
  secretConfig: string;
};

const TYPES: PuzzleType[] = [
  "rune_cipher",
  "sliding_lock",
  "shattered_sigil",
  "arcane_circuit",
  "rune_sequence",
];
const DIFFICULTIES = ["Easy", "Medium", "Hard", "Insane"];

function presetToEditor(type: PuzzleType, preset: PuzzlePreset, id: string | null = null): EditorState {
  return {
    id,
    type,
    title: preset.title,
    description: preset.description,
    difficulty: preset.difficultyLabel,
    moveLimit: preset.moveLimit == null ? "" : String(preset.moveLimit),
    attemptLimit: preset.attemptLimit == null ? "" : String(preset.attemptLimit),
    timeLimit: preset.timeLimitSeconds == null ? "" : String(preset.timeLimitSeconds),
    failureMessage: preset.failureMessage,
    sortOrder: "500",
    publicConfig: JSON.stringify(preset.publicConfig, null, 2),
    secretConfig: JSON.stringify(preset.secretConfig, null, 2),
  };
}

function parseJsonRecord(value: string, label: string): JsonRecord {
  const parsed: unknown = JSON.parse(value || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return parsed as JsonRecord;
}

function roomHref(slug: string, id: string) {
  return slug === "barovia" ? `/campaigns/barovia/puzzles/${id}` : `/puzzles/${id}`;
}

export function PuzzleWorkshop({ campaignId, campaignSlug, theme = "nattau" }: Props) {
  const barovia = theme === "barovia";
  const vault = usePuzzleVault({ campaignId });
  const [editor, setEditor] = useState<EditorState>(() => presetToEditor("rune_cipher", buildPuzzlePreset("rune_cipher", "Medium")));
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const activeCount = useMemo(() => vault.puzzles.filter((puzzle) => puzzle.status === "active").length, [vault.puzzles]);
  const visibleCount = useMemo(() => vault.puzzles.filter((puzzle) => puzzle.is_visible).length, [vault.puzzles]);

  const regenerate = (type = editor.type, difficulty = editor.difficulty) => {
    setEditor(presetToEditor(type, buildPuzzlePreset(type, difficulty), editor.id));
    setFormError(null);
    setMessage(`Generated a fresh ${difficulty} ${PUZZLE_TYPE_LABELS[type]} template.`);
  };

  const changeType = (type: PuzzleType) => {
    setEditor(presetToEditor(type, buildPuzzlePreset(type, editor.difficulty), null));
    setMessage(null);
    setFormError(null);
  };

  const changeDifficulty = (difficulty: string) => {
    const preset = buildPuzzlePreset(editor.type, difficulty);
    setEditor(presetToEditor(editor.type, preset, editor.id));
    setMessage(`Difficulty preset changed to ${difficulty}. Review limits before saving.`);
    setFormError(null);
  };

  const save = async () => {
    setSaving(true);
    setFormError(null);
    setMessage(null);
    try {
      const publicConfig = parseJsonRecord(editor.publicConfig, "Public configuration");
      const secretConfig = parseJsonRecord(editor.secretConfig, "Secret configuration");
      const supabase = createClient();
      const payload = {
        puzzle_type: editor.type,
        title: editor.title.trim(),
        description: editor.description,
        difficulty_label: editor.difficulty,
        move_limit: editor.moveLimit.trim() === "" ? null : Number(editor.moveLimit),
        attempt_limit: editor.attemptLimit.trim() === "" ? null : Number(editor.attemptLimit),
        time_limit_seconds: editor.timeLimit.trim() === "" ? null : Number(editor.timeLimit),
        failure_message: editor.failureMessage.trim() || null,
        sort_order: Number(editor.sortOrder || 500),
        public_config: publicConfig,
        secret_config: secretConfig,
      };
      const { data, error } = await supabase.rpc("save_campaign_puzzle", {
        p_campaign_slug: campaignSlug,
        p_puzzle_id: editor.id,
        p_payload: payload,
      });
      if (error) throw error;
      const id = typeof data === "string" ? data : editor.id;
      setEditor((current) => ({ ...current, id }));
      setMessage(editor.id ? "Puzzle configuration saved. Restart an active run to apply structural changes." : "Puzzle saved as a hidden draft.");
      await vault.refresh(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save the puzzle.");
    } finally {
      setSaving(false);
    }
  };

  const editPuzzle = async (puzzle: CampaignPuzzleRow) => {
    setFormError(null);
    setMessage(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("campaign_puzzle_secrets")
      .select("secret_config")
      .eq("puzzle_id", puzzle.id)
      .maybeSingle();
    if (error) {
      setFormError(error.message);
      return;
    }
    setEditor({
      id: puzzle.id,
      type: puzzle.puzzle_type,
      title: puzzle.title,
      description: puzzle.description,
      difficulty: puzzle.difficulty_label,
      moveLimit: puzzle.move_limit == null ? "" : String(puzzle.move_limit),
      attemptLimit: puzzle.attempt_limit == null ? "" : String(puzzle.attempt_limit),
      timeLimit: puzzle.time_limit_seconds == null ? "" : String(puzzle.time_limit_seconds),
      failureMessage: puzzle.failure_message ?? "",
      sortOrder: String(puzzle.sort_order),
      publicConfig: JSON.stringify(puzzle.public_config, null, 2),
      secretConfig: JSON.stringify((data?.secret_config ?? {}) as JsonRecord, null, 2),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const runRpc = async (id: string, rpc: string, args: Record<string, unknown>, success: string) => {
    setActionId(id);
    setFormError(null);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.rpc(rpc, args);
    setActionId(null);
    if (error) {
      setFormError(error.message);
      return false;
    }
    setMessage(success);
    await vault.refresh(true);
    return true;
  };

  const createFive = async () => {
    setSaving(true);
    setFormError(null);
    setMessage(null);
    try {
      const supabase = createClient();
      for (let index = 0; index < TYPES.length; index += 1) {
        const type = TYPES[index];
        const preset = buildPuzzlePreset(type, "Medium");
        const { error } = await supabase.rpc("save_campaign_puzzle", {
          p_campaign_slug: campaignSlug,
          p_puzzle_id: null,
          p_payload: {
            puzzle_type: type,
            title: preset.title,
            description: preset.description,
            difficulty_label: preset.difficultyLabel,
            move_limit: preset.moveLimit,
            attempt_limit: preset.attemptLimit,
            time_limit_seconds: preset.timeLimitSeconds,
            failure_message: preset.failureMessage,
            sort_order: 500 + index * 10,
            public_config: preset.publicConfig,
            secret_config: preset.secretConfig,
          },
        });
        if (error) throw error;
      }
      setMessage("Created one hidden Medium draft for each of the five puzzle engines.");
      await vault.refresh(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not create the puzzle set.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className={`min-h-screen px-4 py-7 sm:px-6 lg:py-9 ${barovia ? "bg-[#0b070a] text-[#eadfe3]" : ""}`}>
      <div className="mx-auto max-w-7xl">
        <header className={`rounded-[30px] border p-6 sm:p-8 ${barovia ? "border-[#4b2935] bg-[#130c10]" : "border-slate-800 bg-slate-900/75"}`}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className={`text-xs font-black uppercase tracking-[0.3em] ${barovia ? "text-[#9f586a]" : "text-yellow-500"}`}>GM tools</p>
              <h1 className={`mt-3 text-4xl font-black ${barovia ? "font-serif text-[#efdde2]" : "text-slate-50"}`}>Puzzle Workshop</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Create hidden puzzle templates, tune pressure, test them privately, reveal them to players and watch the active solver in real time.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={campaignSlug === "barovia" ? "/campaigns/barovia/puzzles" : "/puzzles"} className="inline-flex min-h-11 items-center rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-300">Open Vault</Link>
              <button type="button" disabled={saving} onClick={() => void createFive()} className={`min-h-11 rounded-xl px-4 text-sm font-black disabled:opacity-40 ${barovia ? "bg-[#77263b] text-[#f6e5e9]" : "bg-yellow-500 text-slate-950"}`}>Create all 5 drafts</button>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-500"><span className="rounded-full border border-slate-800 px-3 py-1">{vault.puzzles.length} templates</span><span className="rounded-full border border-slate-800 px-3 py-1">{activeCount} active</span><span className="rounded-full border border-slate-800 px-3 py-1">{visibleCount} visible</span></div>
        </header>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
          <div className={`rounded-[30px] border p-5 sm:p-6 ${barovia ? "border-[#432833] bg-[#120c10]" : "border-slate-800 bg-slate-900/70"}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Builder</p><h2 className="mt-2 text-2xl font-black">{editor.id ? "Edit puzzle" : "New puzzle"}</h2></div>
              {editor.id ? <button type="button" onClick={() => setEditor(presetToEditor("rune_cipher", buildPuzzlePreset("rune_cipher", "Medium")))} className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-400">New draft</button> : null}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {TYPES.map((type) => <button key={type} type="button" onClick={() => changeType(type)} className={`min-h-14 rounded-xl border px-2 text-xs font-bold transition ${editor.type === type ? barovia ? "border-[#a7556c] bg-[#6a2034]/25 text-[#efc7d1]" : "border-yellow-500/50 bg-yellow-500/10 text-yellow-200" : "border-slate-800 bg-black/10 text-slate-500 hover:text-slate-300"}`}>{PUZZLE_TYPE_LABELS[type]}</button>)}
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className="text-xs font-semibold text-slate-400">Title</span><input value={editor.title} onChange={(event) => setEditor((current) => ({ ...current, title: event.target.value }))} maxLength={120} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none focus:border-yellow-500" /></label>
              <label className="sm:col-span-2"><span className="text-xs font-semibold text-slate-400">Player-facing description</span><textarea value={editor.description} onChange={(event) => setEditor((current) => ({ ...current, description: event.target.value }))} rows={3} maxLength={2000} className="mt-2 w-full resize-y rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none focus:border-yellow-500" /></label>
            </div>

            <div className="mt-5">
              <p className="text-xs font-semibold text-slate-400">Difficulty preset</p>
              <div className="mt-2 grid grid-cols-4 gap-2">{DIFFICULTIES.map((difficulty) => <button key={difficulty} type="button" onClick={() => changeDifficulty(difficulty)} className={`min-h-11 rounded-xl border text-xs font-bold ${editor.difficulty === difficulty ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-200" : "border-slate-800 text-slate-500"}`}>{difficulty}</button>)}</div>
              <button type="button" onClick={() => regenerate()} className="mt-2 text-xs font-semibold text-yellow-300">↻ Regenerate layout / secret for this preset</button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <label><span className="text-xs font-semibold text-slate-400">Move limit</span><input type="number" min={1} max={999} placeholder="∞" value={editor.moveLimit} onChange={(event) => setEditor((current) => ({ ...current, moveLimit: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-3 text-slate-100" /></label>
              <label><span className="text-xs font-semibold text-slate-400">Attempt / mistake limit</span><input type="number" min={1} max={999} placeholder="∞" value={editor.attemptLimit} onChange={(event) => setEditor((current) => ({ ...current, attemptLimit: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-3 text-slate-100" /></label>
              <label><span className="text-xs font-semibold text-slate-400">Timer (seconds)</span><input type="number" min={10} max={86400} placeholder="off" value={editor.timeLimit} onChange={(event) => setEditor((current) => ({ ...current, timeLimit: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-3 text-slate-100" /></label>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_140px]">
              <label><span className="text-xs font-semibold text-slate-400">Failure consequence shown to players</span><textarea value={editor.failureMessage} onChange={(event) => setEditor((current) => ({ ...current, failureMessage: event.target.value }))} rows={2} maxLength={500} className="mt-2 w-full resize-y rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-slate-100" /></label>
              <label><span className="text-xs font-semibold text-slate-400">Sort order</span><input type="number" value={editor.sortOrder} onChange={(event) => setEditor((current) => ({ ...current, sortOrder: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-3 text-slate-100" /></label>
            </div>

            <details className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <summary className="cursor-pointer font-bold text-slate-300">Advanced configuration JSON</summary>
              <p className="mt-2 text-xs leading-5 text-slate-500">Public config is sent to players. Secret config is stored in a separate DM-only table and is never selected by the player client.</p>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <label><span className="text-xs font-semibold text-cyan-300">Public config</span><textarea spellCheck={false} value={editor.publicConfig} onChange={(event) => setEditor((current) => ({ ...current, publicConfig: event.target.value }))} rows={18} className="mt-2 w-full rounded-xl border border-cyan-900/60 bg-black/30 p-3 font-mono text-xs leading-5 text-cyan-50" /></label>
                <label><span className="text-xs font-semibold text-fuchsia-300">Secret config · GM only</span><textarea spellCheck={false} value={editor.secretConfig} onChange={(event) => setEditor((current) => ({ ...current, secretConfig: event.target.value }))} rows={18} className="mt-2 w-full rounded-xl border border-fuchsia-900/60 bg-black/30 p-3 font-mono text-xs leading-5 text-fuchsia-50" /></label>
              </div>
            </details>

            <button type="button" disabled={saving || !editor.title.trim()} onClick={() => void save()} className={`mt-5 min-h-12 w-full rounded-xl font-black disabled:opacity-40 ${barovia ? "bg-[#77263b] text-[#f7e7eb]" : "bg-yellow-500 text-slate-950"}`}>{saving ? "Saving…" : editor.id ? "Save configuration" : "Save hidden draft"}</button>
            {formError ? <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{formError}</p> : null}
            {message ? <p className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</p> : null}
          </div>

          <div className="space-y-4">
            <div className={`rounded-[30px] border p-5 ${barovia ? "border-[#432833] bg-[#120c10]" : "border-slate-800 bg-slate-900/70"}`}>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Campaign library</p>
              <h2 className="mt-2 text-2xl font-black">Prepared enigmas</h2>
              <p className="mt-2 text-xs leading-5 text-slate-500">“Test hidden” starts a private live run only the GM can see. “Start & reveal” creates a fresh run and immediately exposes it to campaign members.</p>
            </div>

            {vault.loading ? <div className="h-40 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/60" /> : vault.puzzles.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">No templates yet. Save one or create the five-puzzle starter set.</div> : vault.puzzles.map((puzzle) => {
              const run = puzzle.current_run_id ? vault.runs[puzzle.current_run_id] : undefined;
              const busy = actionId === puzzle.id;
              return (
                <article key={puzzle.id} className={`rounded-[26px] border p-5 ${barovia ? "border-[#3f2730] bg-[#120c10]" : "border-slate-800 bg-slate-900/75"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className={`text-[10px] font-black uppercase tracking-[0.22em] ${barovia ? "text-[#99596b]" : "text-yellow-500"}`}>{PUZZLE_TYPE_LABELS[puzzle.puzzle_type]} · {puzzle.difficulty_label}</p><h3 className="mt-2 truncate text-xl font-black text-slate-100">{puzzle.title}</h3></div>
                    <div className="flex flex-col items-end gap-1"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${puzzle.is_visible ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-slate-700 text-slate-500"}`}>{puzzle.is_visible ? "visible" : "hidden"}</span><span className="text-[10px] uppercase text-slate-600">{run?.status ?? puzzle.status}</span></div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500"><span className="rounded-xl border border-slate-800 bg-black/10 px-3 py-2">Moves: {puzzle.move_limit ?? "∞"}</span><span className="rounded-xl border border-slate-800 bg-black/10 px-3 py-2">Attempts: {puzzle.attempt_limit ?? "∞"}</span></div>
                  {run?.controller_name && run.status === "active" ? <p className="mt-3 text-xs font-semibold text-cyan-300">● {run.controller_name} currently has control</p> : null}
                  {run?.status === "solved" ? (
                    <p className="mt-3 text-xs font-semibold text-emerald-300">
                      ✓ Solved{run.solved_by_name ? ` by ${run.solved_by_name}` : ""} · {run.move_count} {run.move_count === 1 ? "move" : "moves"}
                    </p>
                  ) : null}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" disabled={busy} onClick={() => void editPuzzle(puzzle)} className="min-h-10 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 disabled:opacity-40">Edit</button>
                    <Link href={roomHref(campaignSlug, puzzle.id)} className="flex min-h-10 items-center justify-center rounded-xl border border-slate-700 text-xs font-semibold text-slate-300">Live room</Link>
                    <button type="button" disabled={busy || puzzle.status === "archived"} onClick={() => void runRpc(puzzle.id, "start_campaign_puzzle", { p_puzzle_id: puzzle.id, p_make_visible: false }, `Started ${puzzle.title} as a hidden test run.`)} className="min-h-10 rounded-xl border border-cyan-700/50 bg-cyan-500/5 text-xs font-bold text-cyan-300 disabled:opacity-35">Test hidden</button>
                    <button type="button" disabled={busy || puzzle.status === "archived"} onClick={() => void runRpc(puzzle.id, "start_campaign_puzzle", { p_puzzle_id: puzzle.id, p_make_visible: true }, `Started and revealed ${puzzle.title}.`)} className={`min-h-10 rounded-xl text-xs font-black disabled:opacity-35 ${barovia ? "bg-[#77263b] text-[#f8e8ec]" : "bg-yellow-500 text-slate-950"}`}>Start & reveal</button>
                    <button type="button" disabled={busy || puzzle.status === "archived"} onClick={() => void runRpc(puzzle.id, "set_campaign_puzzle_visibility", { p_puzzle_id: puzzle.id, p_visible: !puzzle.is_visible }, puzzle.is_visible ? `Hidden ${puzzle.title} from players.` : `Revealed ${puzzle.title} to players.`)} className="min-h-10 rounded-xl border border-slate-700 text-xs font-semibold text-slate-400 disabled:opacity-35">{puzzle.is_visible ? "Hide" : "Reveal"}</button>
                    <button type="button" disabled={busy || puzzle.status === "archived"} onClick={() => { if (window.confirm(`Archive “${puzzle.title}”? Players will no longer see it.`)) void runRpc(puzzle.id, "archive_campaign_puzzle", { p_puzzle_id: puzzle.id }, `Archived ${puzzle.title}.`); }} className="min-h-10 rounded-xl border border-rose-900/50 text-xs font-semibold text-rose-300 disabled:opacity-35">Archive</button>
                    {["solved", "failed", "archived"].includes(run?.status ?? puzzle.status) ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Permanently delete “${puzzle.title}”? This removes the puzzle, final state, runs and move history. This cannot be undone.`
                            )
                          ) {
                            void runRpc(
                              puzzle.id,
                              "delete_campaign_puzzle",
                              { p_puzzle_id: puzzle.id },
                              `Permanently deleted ${puzzle.title}.`
                            );
                          }
                        }}
                        className="col-span-2 min-h-10 rounded-xl border border-red-600/50 bg-red-500/10 text-xs font-black text-red-200 disabled:opacity-35"
                      >
                        Delete permanently
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
            {vault.error && vault.error !== formError ? <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{vault.error}</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
