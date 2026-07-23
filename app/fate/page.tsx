import Link from "next/link";
import { redirect } from "next/navigation";
import { FateAdmin } from "@/components/fate/FateAdmin";
import { FateExperience } from "@/components/fate/FateExperience";
import type {
  FateAdminDraw,
  FateCardDefinition,
  FateCycle,
  FateDraw,
  FateDrawView,
  FateProfile,
} from "@/components/fate/fateTypes";
import { createClient } from "@/lib/supabase/server";

function attachCycle(
  draw: FateDraw,
  cyclesById: Map<string, FateCycle>
): FateDrawView {
  const cycle = cyclesById.get(draw.cycle_id);

  return {
    ...draw,
    cycle_number: cycle?.cycle_number ?? 0,
    cycle_title: cycle?.title ?? "Unknown Fate Cycle",
  };
}

export default async function FatePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profileData) {
    throw new Error("The current Fate profile could not be loaded.");
  }

  const currentProfile = profileData as FateProfile;

  const [
    { data: cardsData, error: cardsError },
    { data: cyclesData, error: cyclesError },
  ] = await Promise.all([
    supabase
      .from("fate_cards")
      .select(
        "id, arcana_number, roman_numeral, slug, name, short_meaning, upright_reward_title, upright_reward_description, reversed_reward_title, reversed_reward_description, mock_symbol, mock_theme, is_active, is_ready"
      )
      .order("arcana_number", { ascending: true }),
    supabase
      .from("fate_cycles")
      .select(
        "id, cycle_number, title, is_active, started_at, closed_at, started_by"
      )
      .order("cycle_number", { ascending: false })
      .limit(100),
  ]);

  if (cardsError) {
    throw new Error(`Fate cards could not be loaded: ${cardsError.message}`);
  }

  if (cyclesError) {
    throw new Error(`Fate cycles could not be loaded: ${cyclesError.message}`);
  }

  const cards = (cardsData ?? []) as FateCardDefinition[];
  const cycles = (cyclesData ?? []) as FateCycle[];
  const currentCycle = cycles.find((cycle) => cycle.is_active) ?? null;
  const cyclesById = new Map(cycles.map((cycle) => [cycle.id, cycle]));

  let content;

  if (currentProfile.role === "dm") {
    const [
      { data: playersData, error: playersError },
      { data: drawsData, error: drawsError },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, role")
        .eq("role", "player")
        .order("display_name", { ascending: true }),
      supabase
        .from("fate_draws")
        .select(
          "id, cycle_id, player_id, card_id, is_reversed, selected_slot, card_slug_snapshot, card_name_snapshot, arcana_number_snapshot, roman_numeral_snapshot, short_meaning_snapshot, mock_symbol_snapshot, mock_theme_snapshot, reward_title_snapshot, reward_description_snapshot, drawn_at"
        )
        .order("drawn_at", { ascending: false })
        .limit(1000),
    ]);

    if (playersError) {
      throw new Error(`Player profiles could not be loaded: ${playersError.message}`);
    }

    if (drawsError) {
      throw new Error(`Fate history could not be loaded: ${drawsError.message}`);
    }

    const players = (playersData ?? []) as FateProfile[];
    const playerNames = new Map(
      players.map((player) => [player.id, player.display_name])
    );

    const adminDraws: FateAdminDraw[] = ((drawsData ?? []) as FateDraw[]).map(
      (draw) => ({
        ...attachCycle(draw, cyclesById),
        player_name: playerNames.get(draw.player_id) ?? "Unknown Player",
      })
    );

    content = (
      <FateAdmin
        currentCycle={currentCycle}
        cycles={cycles}
        players={players}
        draws={adminDraws}
        cards={cards}
      />
    );
  } else {
    const { data: drawsData, error: drawsError } = await supabase
      .from("fate_draws")
      .select(
        "id, cycle_id, player_id, card_id, is_reversed, selected_slot, card_slug_snapshot, card_name_snapshot, arcana_number_snapshot, roman_numeral_snapshot, short_meaning_snapshot, mock_symbol_snapshot, mock_theme_snapshot, reward_title_snapshot, reward_description_snapshot, drawn_at"
      )
      .eq("player_id", currentProfile.id)
      .order("drawn_at", { ascending: false })
      .limit(100);

    if (drawsError) {
      throw new Error(`Your Fate history could not be loaded: ${drawsError.message}`);
    }

    const history = ((drawsData ?? []) as FateDraw[]).map((draw) =>
      attachCycle(draw, cyclesById)
    );

    const currentDraw = currentCycle
      ? history.find((draw) => draw.cycle_id === currentCycle.id) ?? null
      : null;

    content = (
      <FateExperience
        currentCycle={currentCycle}
        initialCurrentDraw={currentDraw}
        initialHistory={history}
        activeCardCount={cards.filter((card) => card.is_active).length}
      />
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 text-slate-100">
      <Link
        href="/"
        className="inline-flex rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-slate-300 transition hover:border-yellow-600/40 hover:text-yellow-300"
      >
        ← Back to Command Center
      </Link>

      <div className="mt-6">
        <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
          Between Sessions
        </p>
        <h1 className="mt-3 text-4xl font-black md:text-5xl">
          The Threads of Fate
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          A once-per-session ritual built around the Major Arcana of the Nattau
          Archipelago. Every draw, including its upright or reversed position,
          is permanently recorded.
        </p>
      </div>

      <div className="mt-8">{content}</div>
    </main>
  );
}
