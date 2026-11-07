import assert from "node:assert/strict";
import test from "node:test";
import { buildBaroviaSessionOverview, sessionDeskView, sessionDeskWindow, type TarokkaReadiness } from "../lib/campaign/baroviaSessionDesk";
import type { SessionPlannerData, SessionProposal } from "../components/session-planner/plannerTypes";

const now = new Date("2026-11-07T15:00:00Z");
const campaignId = "barovia-fixture";

function planner(overrides: Partial<SessionPlannerData> = {}): SessionPlannerData {
  return {
    campaign_id: campaignId, campaign_slug: "barovia", month_start: "2026-11-01", month_end: "2026-11-30",
    current_user_id: "gm", current_user_role: "dm", current_user_planning_enabled: true,
    members: [
      { id: "one", display_name: "One", role: "player", planning_enabled: true },
      { id: "two", display_name: "Two", role: "player", planning_enabled: true },
      { id: "test", display_name: "Test", role: "player", planning_enabled: false },
      { id: "gm", display_name: "GM", role: "dm", planning_enabled: true },
    ], availability: [], proposals: [], ...overrides,
  };
}

function tarokka(): TarokkaReadiness {
  return {
    cycle: { id: "cycle", campaign_id: campaignId, cycle_number: 3, title: "Fixture Turning", is_active: true, draws_open: true, started_at: now.toISOString(), closed_at: null },
    progress: ["one", "two", "test"].map((id, index) => ({
      player_id: id, display_name: id, counts_toward_progress: id !== "test",
      draw_id: index === 1 ? null : `draw-${id}`, drawn_at: index === 1 ? null : now.toISOString(),
      revealed_at: index === 1 ? null : now.toISOString(), card_name: index === 1 ? null : "Fixture omen", is_reversed: false,
    })),
    usage: [{ id: "draw-one", cycle_id: "cycle", used_at: now.toISOString(), revealed_at: now.toISOString() },
      { id: "draw-test", cycle_id: "cycle", used_at: null, revealed_at: now.toISOString() }],
  };
}

function proposal(overrides: Partial<SessionProposal> = {}): SessionProposal {
  return {
    id: "proposal", proposed_date: "2026-11-14", session_mode: "online", message: null, status: "voting",
    created_by: "gm", created_by_name: "GM", created_at: now.toISOString(), updated_at: now.toISOString(), confirmed_at: null,
    votes: [], ...overrides,
  };
}

function overview(p = planner(), t: TarokkaReadiness | null = tarokka()) {
  return buildBaroviaSessionOverview({ campaignId, planner: p, tarokka: t, now });
}

test("planning and omen totals independently respect campaign participation flags", () => {
  const p = planner({ availability: ["one", "test", "gm"].map((id) => ({ user_id: id, availability_date: "2026-11-12", availability_mode: "unavailable", updated_at: now.toISOString() })) });
  const result = overview(p);
  assert.equal(result.eligiblePlayers, 2);
  assert.equal(result.respondents, 1); // 'Unavailable' is still a response.
  assert.deepEqual(result.waitingAvailability, ["Two"]);
  assert.equal(result.tarokka.total, 2);
  assert.equal(result.tarokka.chosen, 1);
  assert.equal(result.tarokka.used, 1);
  assert.equal(result.tarokka.waiting, 1);
  assert.equal(result.players.length, 3);
  assert.equal(result.players.find((player) => player.id === "test")?.omen, "available");
  assert.equal(result.players.find((player) => player.id === "test")?.countsTowardOmens, false);
});

test("expired availability, past votes and confirmed dates do not inflate outstanding work", () => {
  const result = overview(planner({
    availability: ["2026-11-06", "2026-12-01"].map((date) => ({ user_id: "one", availability_date: date, availability_mode: "both", updated_at: now.toISOString() })),
    proposals: [proposal({ proposed_date: "2026-11-06" }), proposal({ status: "confirmed" })],
  }));
  assert.equal(result.respondents, 0);
  assert.equal(result.players[0].daysEntered, 0);
  assert.deepEqual(result.proposals, []);
});

test("vote counts omit GMs, outside players and excluded test accounts without negative waiting totals", () => {
  const votes = ["one", "one", "test", "gm", "stranger"].map((id) => ({ voter_id: id, voter_name: id, vote: "yes" as const, updated_at: now.toISOString() }));
  const result = overview(planner({ proposals: [proposal({ votes })] }));
  assert.equal(result.proposals[0].yes, 1);
  assert.equal(result.proposals[0].waiting, 1);
  assert.equal(result.players.find((player) => player.id === "one")?.votesEntered, 1);
  assert.equal(result.players.find((player) => player.id === "two")?.votesEntered, 0);
});

test("data from another campaign or month is unavailable instead of being mixed into Barovia", () => {
  const other = tarokka();
  other.cycle!.campaign_id = "nattau-fixture";
  const result = overview(planner({ campaign_id: "nattau-fixture", campaign_slug: "nattau" }), other);
  assert.equal(result.planningAvailable, false);
  assert.equal(result.tarokkaAvailable, false);
  assert.deepEqual(result.players, []);
  assert.equal(overview(planner({ month_start: "2026-10-01" })).planningAvailable, false);
});

test("failed reads remain distinguishable from a real empty party or closed deck", () => {
  const failed = buildBaroviaSessionOverview({ campaignId, planner: null, tarokka: null, now });
  assert.equal(failed.planningAvailable, false);
  assert.equal(failed.tarokkaAvailable, false);
  const empty = overview(planner({ members: [] }), { cycle: null, progress: [], usage: [] });
  assert.equal(empty.planningAvailable, true);
  assert.equal(empty.tarokkaAvailable, true);
  assert.equal(empty.eligiblePlayers, 0);
  assert.equal(empty.tarokka.cycle, null);
});

test("old-cycle draws cannot mark an active omen used and unrevealed cards stay face-down", () => {
  const t = tarokka();
  t.usage[0].cycle_id = "old-cycle";
  const stale = overview(planner(), t);
  assert.equal(stale.tarokka.used, 0);
  assert.equal(stale.players[0].omen, "unavailable");
  t.usage[0] = { id: "draw-one", cycle_id: "cycle", used_at: null, revealed_at: null };
  assert.equal(overview(planner(), t).players[0].omen, "face-down");
  t.cycle = null;
  assert.equal(overview(planner(), t).players[0].omen, "not-open");
});

test("the monthly planning snapshot follows Warsaw at UTC and DST boundaries", () => {
  assert.equal(sessionDeskWindow(new Date("2026-10-31T23:30:00Z")).monthStart, "2026-11-01");
  assert.equal(sessionDeskWindow(new Date("2026-05-31T22:30:00Z")).today, "2026-06-01");
  assert.equal(sessionDeskWindow(new Date("2026-10-25T01:30:00Z")).today, "2026-10-25");
});

test("only supported desk views are accepted from the URL", () => {
  assert.equal(sessionDeskView("planning"), "planning");
  assert.equal(sessionDeskView("publication"), "publication");
  for (const value of [undefined, "overview", "tarokka", "//example.com", ["planning", "publication"]]) {
    assert.equal(sessionDeskView(value), "overview");
  }
});
