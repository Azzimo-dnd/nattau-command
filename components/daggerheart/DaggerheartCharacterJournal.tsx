"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type CharacterStoryRow = {
  id: string;
  campaign_id: string;
  player_id: string | null;
  is_active: boolean;
  name: string;
  description: string;
  background_answers: string[];
  connections: string[];
  state_revision: number;
};

type JournalEntry = {
  id: string;
  campaign_id: string;
  character_id: string;
  author_id: string;
  session_date: string;
  session_label: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};

type StoryDraft = {
  description: string;
  background_answers: string[];
  connections: string[];
};

type JournalDraft = {
  session_date: string;
  session_label: string;
  title: string;
  content: string;
};

type Props = {
  campaignId: string;
  currentUserId: string;
  isDm: boolean;
};

const fieldClass =
  "min-h-11 w-full rounded-xl border border-[#58323f] bg-[#100a0e] px-3 py-2 text-sm text-[#eadfe3] outline-none transition placeholder:text-[#6f5c63] focus:border-[#a34d64] focus:ring-2 focus:ring-[#6e263b]/30";
const primaryButton =
  "inline-flex min-h-10 items-center justify-center rounded-xl border border-[#9b4b61] bg-[#6b2438] px-4 text-sm font-bold text-[#f6e4e9] transition hover:bg-[#7a2a40] disabled:cursor-not-allowed disabled:opacity-45";
const secondaryButton =
  "inline-flex min-h-10 items-center justify-center rounded-xl border border-[#5a3441] bg-[#221219] px-3 text-sm font-semibold text-[#ddbdc6] transition hover:border-[#8b465a] hover:bg-[#321721] disabled:cursor-not-allowed disabled:opacity-45";

function asStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function localToday() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function emptyJournalDraft(): JournalDraft {
  return {
    session_date: localToday(),
    session_label: "",
    title: "",
    content: "",
  };
}

function formatSessionDate(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

function StringListEditor({
  value,
  onChange,
  placeholder,
  addLabel,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
  addLabel: string;
}) {
  const entries = value.length ? value : [""];

  return (
    <div className="space-y-2">
      {entries.map((item, index) => (
        <div key={index} className="flex items-start gap-2">
          <textarea
            className={`${fieldClass} min-h-24 flex-1`}
            value={item}
            placeholder={placeholder}
            onChange={(event) => {
              const next = value.length ? [...value] : [""];
              next[index] = event.target.value;
              onChange(next);
            }}
          />
          <button
            type="button"
            className={`${secondaryButton} min-w-10 px-0`}
            aria-label="Remove entry"
            onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className={secondaryButton}
        onClick={() => onChange([...value, ""])}
      >
        + {addLabel}
      </button>
    </div>
  );
}

export function DaggerheartCharacterJournal({
  campaignId,
  currentUserId,
  isDm,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [characters, setCharacters] = useState<CharacterStoryRow[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [loadingCharacters, setLoadingCharacters] = useState(true);
  const [characterError, setCharacterError] = useState<string | null>(null);
  const [storyDraft, setStoryDraft] = useState<StoryDraft>({
    description: "",
    background_answers: [],
    connections: [],
  });
  const [storySaving, setStorySaving] = useState(false);
  const [storyMessage, setStoryMessage] = useState<string | null>(null);

  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalError, setJournalError] = useState<string | null>(null);
  const [journalDraft, setJournalDraft] = useState<JournalDraft>(emptyJournalDraft);
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null);
  const [journalSaving, setJournalSaving] = useState(false);
  const [oldestFirst, setOldestFirst] = useState(false);

  const selectedCharacter = useMemo(
    () => characters.find((character) => character.id === selectedCharacterId) ?? null,
    [characters, selectedCharacterId]
  );

  const canEditSelected = Boolean(
    selectedCharacter &&
      (isDm || selectedCharacter.player_id === currentUserId)
  );

  const loadCharacters = useCallback(async () => {
    setLoadingCharacters(true);
    setCharacterError(null);

    let query = supabase
      .from("daggerheart_characters")
      .select(
        "id,campaign_id,player_id,is_active,name,description,background_answers,connections,state_revision"
      )
      .eq("campaign_id", campaignId)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (!isDm) {
      query = query.eq("player_id", currentUserId);
    }

    const { data, error } = await query;
    if (error) {
      setCharacterError(error.message);
      setCharacters([]);
      setSelectedCharacterId("");
      setLoadingCharacters(false);
      return;
    }

    const rows = (data ?? []).map((row) => ({
      ...(row as Omit<CharacterStoryRow, "background_answers" | "connections" | "state_revision">),
      background_answers: asStringList(row.background_answers),
      connections: asStringList(row.connections),
      state_revision: Number(row.state_revision ?? 0),
    }));

    setCharacters(rows);
    setSelectedCharacterId((current) =>
      rows.some((row) => row.id === current) ? current : rows[0]?.id ?? ""
    );
    setLoadingCharacters(false);
  }, [campaignId, currentUserId, isDm, supabase]);

  useEffect(() => {
    void loadCharacters();
  }, [loadCharacters]);

  useEffect(() => {
    if (!selectedCharacter) {
      setStoryDraft({ description: "", background_answers: [], connections: [] });
      return;
    }
    setStoryDraft({
      description: selectedCharacter.description ?? "",
      background_answers: selectedCharacter.background_answers ?? [],
      connections: selectedCharacter.connections ?? [],
    });
    setStoryMessage(null);
    setEditingJournalId(null);
    setJournalDraft(emptyJournalDraft());
  }, [selectedCharacter]);

  const loadJournal = useCallback(async () => {
    if (!selectedCharacterId) {
      setJournalEntries([]);
      return;
    }

    setJournalLoading(true);
    setJournalError(null);
    const { data, error } = await supabase
      .from("daggerheart_character_journal_entries")
      .select(
        "id,campaign_id,character_id,author_id,session_date,session_label,title,content,created_at,updated_at"
      )
      .eq("campaign_id", campaignId)
      .eq("character_id", selectedCharacterId)
      .order("session_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      setJournalError(error.message);
      setJournalEntries([]);
    } else {
      setJournalEntries((data ?? []) as JournalEntry[]);
    }
    setJournalLoading(false);
  }, [campaignId, selectedCharacterId, supabase]);

  useEffect(() => {
    void loadJournal();
  }, [loadJournal]);

  async function saveStory() {
    if (!selectedCharacter || !canEditSelected || storySaving) return;

    const backgroundAnswers = storyDraft.background_answers
      .map((item) => item.trim())
      .filter(Boolean);
    const connections = storyDraft.connections
      .map((item) => item.trim())
      .filter(Boolean);

    setStorySaving(true);
    setStoryMessage(null);
    const { data, error } = await supabase
      .from("daggerheart_characters")
      .update({
        description: storyDraft.description.trim(),
        background_answers: backgroundAnswers,
        connections,
      })
      .eq("id", selectedCharacter.id)
      .eq("campaign_id", campaignId)
      .eq("state_revision", selectedCharacter.state_revision)
      .select(
        "id,campaign_id,player_id,is_active,name,description,background_answers,connections,state_revision"
      )
      .maybeSingle();

    if (error) {
      setStoryMessage(error.message);
      setStorySaving(false);
      return;
    }
    if (!data) {
      setStoryMessage(
        "This character changed in another tab or session. Reload the page before saving the story again."
      );
      setStorySaving(false);
      return;
    }

    const saved: CharacterStoryRow = {
      ...(data as Omit<CharacterStoryRow, "background_answers" | "connections" | "state_revision">),
      background_answers: asStringList(data.background_answers),
      connections: asStringList(data.connections),
      state_revision: Number(data.state_revision ?? selectedCharacter.state_revision + 1),
    };
    setCharacters((current) =>
      current.map((character) => (character.id === saved.id ? saved : character))
    );
    setStoryDraft({
      description: saved.description,
      background_answers: saved.background_answers,
      connections: saved.connections,
    });
    setStoryMessage("Character story saved.");
    setStorySaving(false);
  }

  async function saveJournalEntry() {
    if (!selectedCharacter || !canEditSelected || journalSaving) return;
    const content = journalDraft.content.trim();
    if (!content) {
      setJournalError("Write at least one note before saving this journal entry.");
      return;
    }

    setJournalSaving(true);
    setJournalError(null);
    const payload = {
      session_date: journalDraft.session_date || localToday(),
      session_label: journalDraft.session_label.trim(),
      title: journalDraft.title.trim(),
      content,
    };

    const result = editingJournalId
      ? await supabase
          .from("daggerheart_character_journal_entries")
          .update(payload)
          .eq("id", editingJournalId)
          .eq("campaign_id", campaignId)
          .eq("character_id", selectedCharacter.id)
          .select("*")
          .single()
      : await supabase
          .from("daggerheart_character_journal_entries")
          .insert({
            campaign_id: campaignId,
            character_id: selectedCharacter.id,
            ...payload,
          })
          .select("*")
          .single();

    if (result.error) {
      setJournalError(result.error.message);
      setJournalSaving(false);
      return;
    }

    const saved = result.data as JournalEntry;
    setJournalEntries((current) => [
      saved,
      ...current.filter((entry) => entry.id !== saved.id),
    ]);
    setEditingJournalId(null);
    setJournalDraft(emptyJournalDraft());
    setJournalSaving(false);
  }

  function editJournalEntry(entry: JournalEntry) {
    setEditingJournalId(entry.id);
    setJournalDraft({
      session_date: entry.session_date,
      session_label: entry.session_label,
      title: entry.title,
      content: entry.content,
    });
    setJournalError(null);
  }

  async function deleteJournalEntry(entry: JournalEntry) {
    if (!canEditSelected || journalSaving) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete ${entry.session_label || entry.title || "this journal entry"}?`)
    ) {
      return;
    }

    setJournalSaving(true);
    setJournalError(null);
    const { error } = await supabase
      .from("daggerheart_character_journal_entries")
      .delete()
      .eq("id", entry.id)
      .eq("campaign_id", campaignId)
      .eq("character_id", entry.character_id);

    if (error) {
      setJournalError(error.message);
    } else {
      setJournalEntries((current) => current.filter((item) => item.id !== entry.id));
      if (editingJournalId === entry.id) {
        setEditingJournalId(null);
        setJournalDraft(emptyJournalDraft());
      }
    }
    setJournalSaving(false);
  }

  const orderedEntries = useMemo(() => {
    return [...journalEntries].sort((left, right) => {
      const dateOrder = left.session_date.localeCompare(right.session_date);
      if (dateOrder !== 0) return oldestFirst ? dateOrder : -dateOrder;
      const createdOrder = left.created_at.localeCompare(right.created_at);
      return oldestFirst ? createdOrder : -createdOrder;
    });
  }, [journalEntries, oldestFirst]);

  if (loadingCharacters) {
    return (
      <div className="rounded-2xl border border-[#402630] bg-[#120c10]/80 p-6 text-sm text-[#a9969d]">
        Opening the character journal…
      </div>
    );
  }

  if (characterError) {
    return (
      <div className="rounded-2xl border border-red-900/60 bg-red-950/25 p-5 text-sm text-red-200">
        {characterError}
      </div>
    );
  }

  if (!selectedCharacter) {
    return (
      <div className="rounded-2xl border border-[#4a303a] bg-[#120c10]/88 p-6 text-center">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9f6878]">
          Character journal
        </p>
        <h2 className="mt-2 font-serif text-2xl font-black text-[#ead7dc]">
          No active character found
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#927e85]">
          {isDm
            ? "There are no active Daggerheart characters in this campaign yet."
            : "Your GM needs to assign your character before a personal story and journal can be created."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {isDm && characters.length > 1 && (
        <section className="rounded-2xl border border-[#402630] bg-[#100a0e]/90 p-4">
          <label className="block max-w-xl">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#9b6877]">
              Character journal
            </span>
            <select
              className={fieldClass}
              value={selectedCharacter.id}
              onChange={(event) => setSelectedCharacterId(event.target.value)}
            >
              {characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name || "Unnamed Wanderer"}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}

      <section className="overflow-hidden rounded-[26px] border border-[#4c2c37] bg-[#110a0e]/92 shadow-2xl shadow-black/20">
        <div className="border-b border-[#38232c] bg-gradient-to-r from-[#2d111b] via-[#1a0d13] to-[#100a0e] px-5 py-5 sm:px-6">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#a65a70]">
            Before the Mists
          </p>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-serif text-2xl font-black text-[#f0dde2]">
                {selectedCharacter.name || "Unnamed Wanderer"} · Backstory
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#a18d94]">
                Character history can be completed or expanded at any time, even if it was skipped during guided creation.
              </p>
            </div>
            <span className="rounded-full border border-[#55323e] bg-black/20 px-3 py-1.5 text-xs font-semibold text-[#b89ea6]">
              Player + GM
            </span>
          </div>
        </div>

        <div className="space-y-6 p-5 sm:p-6">
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-[#a27b88]">
              Character description
            </span>
            <textarea
              className={`${fieldClass} min-h-28`}
              disabled={!canEditSelected}
              value={storyDraft.description}
              placeholder="Appearance, mannerisms, first impressions, scars, habits…"
              onChange={(event) =>
                setStoryDraft((current) => ({ ...current, description: event.target.value }))
              }
            />
          </label>

          <div className="grid gap-6 xl:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[#a27b88]">
                Background & history
              </p>
              {canEditSelected ? (
                <StringListEditor
                  value={storyDraft.background_answers}
                  onChange={(background_answers) =>
                    setStoryDraft((current) => ({ ...current, background_answers }))
                  }
                  placeholder="Background answer, important history, a debt, a secret, an unresolved thread…"
                  addLabel="background note"
                />
              ) : storyDraft.background_answers.length ? (
                <div className="space-y-2">
                  {storyDraft.background_answers.map((item, index) => (
                    <p key={index} className="rounded-xl border border-[#35252c] bg-black/15 p-3 text-sm leading-6 text-[#c6b1b8]">
                      {item}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#7f6c73]">No background has been written yet.</p>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[#a27b88]">
                Connections
              </p>
              {canEditSelected ? (
                <StringListEditor
                  value={storyDraft.connections}
                  onChange={(connections) =>
                    setStoryDraft((current) => ({ ...current, connections }))
                  }
                  placeholder="A bond, promise, suspicion or history with another character…"
                  addLabel="connection"
                />
              ) : storyDraft.connections.length ? (
                <div className="space-y-2">
                  {storyDraft.connections.map((item, index) => (
                    <p key={index} className="rounded-xl border border-[#35252c] bg-black/15 p-3 text-sm leading-6 text-[#c6b1b8]">
                      {item}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#7f6c73]">No connections have been recorded yet.</p>
              )}
            </div>
          </div>

          {canEditSelected && (
            <div className="flex flex-wrap items-center gap-3 border-t border-[#322029] pt-4">
              <button
                type="button"
                className={primaryButton}
                disabled={storySaving}
                onClick={() => void saveStory()}
              >
                {storySaving ? "Saving story…" : "Save backstory"}
              </button>
              {storyMessage && (
                <span className="text-sm text-[#c5aab3]">{storyMessage}</span>
              )}
            </div>
          )}
        </div>
      </section>

      <section id="character-journal" className="overflow-hidden rounded-[26px] border border-[#4c2c37] bg-[#110a0e]/92 shadow-2xl shadow-black/20 scroll-mt-24">
        <div className="border-b border-[#38232c] bg-gradient-to-r from-[#261018] via-[#160c11] to-[#100a0e] px-5 py-5 sm:px-6">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#a65a70]">
            Chronicle of the Mists
          </p>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-serif text-2xl font-black text-[#f0dde2]">
                Character Journal
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#a18d94]">
                Keep notes for each session and build a chronological record of the character's journey. Entries are visible only to this character's player and the campaign GM.
              </p>
            </div>
            <button
              type="button"
              className={secondaryButton}
              onClick={() => setOldestFirst((value) => !value)}
            >
              {oldestFirst ? "Oldest first" : "Newest first"}
            </button>
          </div>
        </div>

        <div className="space-y-6 p-5 sm:p-6">
          {canEditSelected && (
            <div className="rounded-2xl border border-[#422832] bg-black/15 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#a56a7a]">
                    {editingJournalId ? "Edit entry" : "New entry"}
                  </p>
                  <h3 className="mt-1 font-serif text-xl font-black text-[#ead7dc]">
                    {editingJournalId ? "Rewrite this memory" : "Record a session"}
                  </h3>
                </div>
                {editingJournalId && (
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={() => {
                      setEditingJournalId(null);
                      setJournalDraft(emptyJournalDraft());
                      setJournalError(null);
                    }}
                  >
                    Cancel edit
                  </button>
                )}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <label>
                  <span className="mb-1.5 block text-xs text-[#a48d95]">Session date</span>
                  <input
                    type="date"
                    className={fieldClass}
                    value={journalDraft.session_date}
                    onChange={(event) =>
                      setJournalDraft((current) => ({ ...current, session_date: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span className="mb-1.5 block text-xs text-[#a48d95]">Session label</span>
                  <input
                    className={fieldClass}
                    value={journalDraft.session_label}
                    placeholder="Session 4"
                    maxLength={120}
                    onChange={(event) =>
                      setJournalDraft((current) => ({ ...current, session_label: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span className="mb-1.5 block text-xs text-[#a48d95]">Entry title</span>
                  <input
                    className={fieldClass}
                    value={journalDraft.title}
                    placeholder="The road to Vallaki"
                    maxLength={160}
                    onChange={(event) =>
                      setJournalDraft((current) => ({ ...current, title: event.target.value }))
                    }
                  />
                </label>
              </div>

              <label className="mt-3 block">
                <span className="mb-1.5 block text-xs text-[#a48d95]">Session notes</span>
                <textarea
                  className={`${fieldClass} min-h-44`}
                  value={journalDraft.content}
                  maxLength={12000}
                  placeholder="What happened, what your character learned, who they trust, promises, clues, plans, personal thoughts…"
                  onChange={(event) =>
                    setJournalDraft((current) => ({ ...current, content: event.target.value }))
                  }
                />
              </label>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className={primaryButton}
                  disabled={journalSaving || !journalDraft.content.trim()}
                  onClick={() => void saveJournalEntry()}
                >
                  {journalSaving
                    ? "Saving entry…"
                    : editingJournalId
                      ? "Save changes"
                      : "Add journal entry"}
                </button>
                <span className="text-xs text-[#7e6971]">
                  {journalDraft.content.length.toLocaleString()} / 12,000 characters
                </span>
              </div>
            </div>
          )}

          {journalError && (
            <div className="rounded-xl border border-red-900/60 bg-red-950/25 p-4 text-sm text-red-200">
              {journalError}
            </div>
          )}

          {journalLoading ? (
            <p className="rounded-xl border border-[#35252c] bg-black/15 p-5 text-sm text-[#917e85]">
              Turning the journal pages…
            </p>
          ) : orderedEntries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#49303a] bg-black/10 p-8 text-center">
              <p className="font-serif text-xl font-black text-[#d8c2c9]">The pages are still blank.</p>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#806d74]">
                Add the first session entry when this character has something worth remembering — or something they are afraid to forget.
              </p>
            </div>
          ) : (
            <div className="relative space-y-4 before:absolute before:bottom-4 before:left-[13px] before:top-4 before:w-px before:bg-[#4a2d37] sm:before:left-[17px]">
              {orderedEntries.map((entry) => (
                <article key={entry.id} className="relative pl-9 sm:pl-11">
                  <span className="absolute left-[7px] top-6 size-3 rounded-full border-2 border-[#a5566d] bg-[#1a0d13] sm:left-[11px]" aria-hidden="true" />
                  <div className="rounded-2xl border border-[#3e2831] bg-black/15 p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <time className="font-bold uppercase tracking-[0.12em] text-[#b36d80]" dateTime={entry.session_date}>
                            {formatSessionDate(entry.session_date)}
                          </time>
                          {entry.session_label && (
                            <span className="rounded-full border border-[#55333e] bg-[#25131a] px-2.5 py-1 font-bold text-[#c5a8b1]">
                              {entry.session_label}
                            </span>
                          )}
                        </div>
                        <h3 className="mt-2 font-serif text-xl font-black text-[#ead7dc]">
                          {entry.title || entry.session_label || "Untitled memory"}
                        </h3>
                      </div>
                      {canEditSelected && (
                        <div className="flex gap-2">
                          <button type="button" className={secondaryButton} onClick={() => editJournalEntry(entry)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-red-900/60 bg-red-950/15 px-3 text-sm font-semibold text-red-200/80 transition hover:border-red-700 hover:bg-red-950/35"
                            onClick={() => void deleteJournalEntry(entry)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#c5b1b7]">
                      {entry.content}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
