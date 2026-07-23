"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FateCard } from "./FateCard";
import type {
  FateAdminDraw,
  FateCardDefinition,
  FateCycle,
  FateProfile,
} from "./fateTypes";

type AdminTab = "overview" | "history" | "deck";

type FateAdminProps = {
  currentCycle: FateCycle | null;
  cycles: FateCycle[];
  players: FateProfile[];
  draws: FateAdminDraw[];
  cards: FateCardDefinition[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function FateAdmin({
  currentCycle,
  cycles,
  players,
  draws,
  cards,
}: FateAdminProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [cycleTitle, setCycleTitle] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("all");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentDraws = currentCycle
    ? draws.filter((draw) => draw.cycle_id === currentCycle.id)
    : [];

  const currentDrawByPlayer = new Map(
    currentDraws.map((draw) => [draw.player_id, draw])
  );

  const drawnCount = players.filter((player) =>
    currentDrawByPlayer.has(player.id)
  ).length;
  const waitingCount = players.length - drawnCount;
  const activeCards = cards.filter((card) => card.is_active).length;
  const readyCards = cards.filter((card) => card.is_ready).length;

  const visibleHistory = useMemo(() => {
    if (selectedPlayerId === "all") return draws;
    return draws.filter((draw) => draw.player_id === selectedPlayerId);
  }, [draws, selectedPlayerId]);

  async function startNewCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const confirmed = window.confirm(
      currentCycle
        ? "Close the current Fate Cycle and allow every player to draw again?"
        : "Open the first Fate Cycle?"
    );

    if (!confirmed) return;

    setErrorMessage(null);
    setPendingAction("new-cycle");

    const supabase = createClient();
    const { error } = await supabase.rpc("start_new_fate_cycle", {
      p_title: cycleTitle.trim() || null,
    });

    if (error) {
      setErrorMessage(error.message);
      setPendingAction(null);
      return;
    }

    setCycleTitle("");
    setPendingAction(null);
    router.refresh();
  }

  async function toggleCard(card: FateCardDefinition) {
    setErrorMessage(null);
    setPendingAction(`card-${card.id}`);

    const supabase = createClient();
    const { error } = await supabase.rpc("set_fate_card_active", {
      p_card_id: card.id,
      p_active: !card.is_active,
    });

    if (error) {
      setErrorMessage(error.message);
      setPendingAction(null);
      return;
    }

    setPendingAction(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-yellow-600/20 bg-gradient-to-br from-slate-900 to-slate-950 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
              Game Master Control
            </p>
            <h2 className="mt-3 text-3xl font-black text-slate-100">
              Fate Cycle Administration
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Open a new cycle after each session, review every player draw and
              control which Major Arcana are currently part of the deck.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-5 py-4 text-right">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Current cycle
            </p>
            <p className="mt-1 text-2xl font-black text-yellow-300">
              {currentCycle ? `#${currentCycle.cycle_number}` : "Closed"}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {currentCycle?.title ?? "No active Fate Cycle"}
            </p>
          </div>
        </div>

        <form
          onSubmit={startNewCycle}
          className="mt-6 grid gap-3 md:grid-cols-[1fr_auto]"
        >
          <input
            value={cycleTitle}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setCycleTitle(event.target.value)
            }
            maxLength={80}
            placeholder="Optional title, e.g. Before the Merrydock Expedition"
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-yellow-500"
          />
          <button
            type="submit"
            disabled={pendingAction !== null}
            className="rounded-xl bg-yellow-500 px-5 py-3 font-black text-slate-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pendingAction === "new-cycle"
              ? "Opening..."
              : currentCycle
                ? "Start New Fate Cycle"
                : "Open Fate Cycle"}
          </button>
        </form>

        {errorMessage && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {errorMessage}
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">Players</p>
          <p className="mt-2 text-3xl font-black text-slate-100">{players.length}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-600">
            Eligible profiles
          </p>
        </div>
        <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-5">
          <p className="text-sm text-green-300">Drawn this cycle</p>
          <p className="mt-2 text-3xl font-black text-green-300">{drawnCount}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-green-500/60">
            Fate recorded
          </p>
        </div>
        <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-5">
          <p className="text-sm text-orange-300">Still waiting</p>
          <p className="mt-2 text-3xl font-black text-orange-300">{waitingCount}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-orange-500/60">
            No draw yet
          </p>
        </div>
        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-5">
          <p className="text-sm text-yellow-300">Active arcana</p>
          <p className="mt-2 text-3xl font-black text-yellow-300">
            {activeCards} / {cards.length}
          </p>
          <p className="mt-1 text-xs uppercase tracking-wide text-yellow-500/60">
            {readyCards} rewards ready
          </p>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-900 p-2">
        {([
          ["overview", "Current Cycle"],
          ["history", "Player History"],
          ["deck", "Deck Control"],
        ] as Array<[AdminTab, string]>).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              activeTab === tab
                ? "bg-yellow-500 text-slate-950"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
                Player Status
              </p>
              <h2 className="mt-3 text-2xl font-bold">Current Fate Cycle</h2>
            </div>
            {currentCycle && (
              <p className="text-sm text-slate-500">
                Opened {formatDate(currentCycle.started_at)}
              </p>
            )}
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-600">
                  <th className="px-3 py-3">Player</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Arcana</th>
                  <th className="px-3 py-3">Position</th>
                  <th className="px-3 py-3">Drawn</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player) => {
                  const draw = currentDrawByPlayer.get(player.id);

                  return (
                    <tr key={player.id} className="border-b border-slate-800/70">
                      <td className="px-3 py-4 font-bold text-slate-200">
                        {player.display_name}
                      </td>
                      <td className="px-3 py-4">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs ${
                            draw
                              ? "border-green-500/30 bg-green-500/10 text-green-300"
                              : "border-orange-500/30 bg-orange-500/10 text-orange-300"
                          }`}
                        >
                          {draw ? "Drawn" : "Waiting"}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-slate-300">
                        {draw ? draw.card_name_snapshot : "—"}
                      </td>
                      <td className="px-3 py-4 text-slate-400">
                        {draw ? (draw.is_reversed ? "Reversed" : "Upright") : "—"}
                      </td>
                      <td className="px-3 py-4 text-slate-500">
                        {draw ? formatDate(draw.drawn_at) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {players.length === 0 && (
            <p className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-500">
              No player profiles were found.
            </p>
          )}
        </section>
      )}

      {activeTab === "history" && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
                Hall of Fate
              </p>
              <h2 className="mt-3 text-2xl font-bold">Player Draw History</h2>
            </div>

            <label className="text-sm text-slate-400">
              Player
              <select
                value={selectedPlayerId}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  setSelectedPlayerId(event.target.value)
                }
                className="ml-3 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200 outline-none focus:border-yellow-500"
              >
                <option value="all">All players</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.display_name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5 space-y-3">
            {visibleHistory.map((draw) => (
              <article
                key={draw.id}
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-600">
                      {draw.player_name} · Cycle {draw.cycle_number}
                    </p>
                    <h3 className="mt-1 font-bold text-yellow-300">
                      {draw.card_name_snapshot} · {draw.is_reversed ? "Reversed" : "Upright"}
                    </h3>
                    <p className="mt-2 text-sm font-semibold text-slate-200">
                      {draw.reward_title_snapshot}
                    </p>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
                      {draw.reward_description_snapshot}
                    </p>
                  </div>

                  <time className="text-xs text-slate-600">
                    {formatDate(draw.drawn_at)}
                  </time>
                </div>
              </article>
            ))}

            {visibleHistory.length === 0 && (
              <p className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-500">
                No draws match this filter.
              </p>
            )}
          </div>
        </section>
      )}

      {activeTab === "deck" && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
              Major Arcana
            </p>
            <h2 className="mt-3 text-2xl font-bold">Deck Control</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              The first twelve cards have complete rewards and can be toggled.
              The remaining ten are seeded as locked drafts for later artwork and
              reward design. At least three cards must remain active.
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <article
                key={card.id}
                className={`flex gap-4 rounded-2xl border p-4 ${
                  card.is_active
                    ? "border-yellow-600/30 bg-yellow-500/5"
                    : "border-slate-800 bg-slate-950/55"
                }`}
              >
                <div className="shrink-0">
                  <FateCard
                    romanNumeral={card.roman_numeral}
                    name={card.name}
                    meaning={card.short_meaning}
                    symbol={card.mock_symbol}
                    theme={card.mock_theme}
                    flipped
                    compact
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-wider ${
                        card.is_active
                          ? "border-green-500/30 bg-green-500/10 text-green-300"
                          : "border-slate-700 bg-slate-900 text-slate-500"
                      }`}
                    >
                      {card.is_active ? "Active" : "Inactive"}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-wider ${
                        card.is_ready
                          ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                          : "border-purple-500/30 bg-purple-500/10 text-purple-300"
                      }`}
                    >
                      {card.is_ready ? "Ready" : "Draft"}
                    </span>
                  </div>

                  <h3 className="mt-3 font-bold text-slate-100">{card.name}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {card.short_meaning}
                  </p>

                  <button
                    type="button"
                    disabled={!card.is_ready || pendingAction !== null}
                    onClick={() => toggleCard(card)}
                    className="mt-4 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-yellow-500 hover:text-yellow-300 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    {pendingAction === `card-${card.id}`
                      ? "Saving..."
                      : card.is_active
                        ? "Remove from deck"
                        : card.is_ready
                          ? "Add to deck"
                          : "Reward design pending"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
          Cycle Archive
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {cycles.map((cycle) => (
            <span
              key={cycle.id}
              className={`rounded-full border px-3 py-2 text-xs ${
                cycle.is_active
                  ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
                  : "border-slate-700 bg-slate-950 text-slate-500"
              }`}
            >
              #{cycle.cycle_number} · {cycle.title}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
