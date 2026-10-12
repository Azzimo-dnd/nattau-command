"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CHRONICLE_TAGS, type ChronicleEntry } from "@/lib/chronicle/types";

type Draft = { title: string; description: string; tag: string };
const emptyDraft: Draft = { title: "", description: "", tag: "Military" };

export function ChronicleManager({ campaignId, initialEntries }: {
  campaignId: string;
  initialEntries: ChronicleEntry[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState(initialEntries);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const tagOptions = Array.from(new Set([...CHRONICLE_TAGS, ...entries.map(entry => entry.tag)]));

  function resetEditor() {
    setEditingId(null);
    setDraft(emptyDraft);
    setError("");
  }

  function beginEdit(entry: ChronicleEntry) {
    setEditingId(entry.id);
    setDraft({ title: entry.title, description: entry.description, tag: entry.tag });
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function reload() {
    const { data, error: loadError } = await supabase
      .from("campaign_chronicle_entries")
      .select("id, title, description, tag, created_at, sort_index")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .order("sort_index", { ascending: false });
    if (loadError) throw loadError;
    setEntries((data ?? []) as ChronicleEntry[]);
    router.refresh();
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const title = draft.title.trim();
    const description = draft.description.trim();
    const tag = draft.tag.trim();
    if (!title || !description || !tag || title.length > 140 || description.length > 2500 || tag.length > 50) {
      setError("Provide a title (1–140 characters), description (1–2500 characters), and event type.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (editingId) {
        const { data, error: saveError } = await supabase
          .from("campaign_chronicle_entries")
          .update({ title, description, tag })
          .eq("campaign_id", campaignId)
          .eq("id", editingId)
          .select("id");
        if (saveError) throw saveError;
        if (!data?.length) throw new Error("Entry not found or you do not have permission to edit it.");
      } else {
        const { data, error: saveError } = await supabase
          .from("campaign_chronicle_entries")
          .insert({ campaign_id: campaignId, title, description, tag })
          .select("id");
        if (saveError) throw saveError;
        if (!data?.length) throw new Error("Entry was not created.");
      }
      await reload();
      resetEditor();
      setMessage(editingId ? "Entry updated." : "Entry published to the Chronicle.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save the entry.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(entry: ChronicleEntry) {
    if (busy || !window.confirm('Permanently delete "' + entry.title + '" from the Chronicle?')) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const { data, error: deleteError } = await supabase
        .from("campaign_chronicle_entries")
        .delete()
        .eq("campaign_id", campaignId)
        .eq("id", entry.id)
        .select("id");
      if (deleteError) throw deleteError;
      if (!data?.length) throw new Error("Entry not found or you do not have permission to delete it.");
      await reload();
      if (editingId === entry.id) resetEditor();
      setMessage("Entry deleted.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete the entry.");
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20";
  const button = "min-h-11 rounded-xl border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="h-fit rounded-3xl border border-yellow-600/20 bg-slate-900/70 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-yellow-500">GM Only</p>
            <h2 className="mt-2 text-xl font-bold text-slate-100">{editingId ? "Edit event" : "Add an event"}</h2>
          </div>
          {editingId && (
            <button type="button" className={button + " border-slate-700 text-slate-200"} disabled={busy} onClick={resetEditor}>
              Cancel editing
            </button>
          )}
        </div>
        <form onSubmit={save} className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">Event title</span>
            <input required maxLength={140} className={field} value={draft.title}
              onChange={event => setDraft({ ...draft, title: event.target.value })}
              placeholder="e.g. The Northern Border Secured" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">Event type</span>
            <select className={field} value={draft.tag}
              onChange={event => setDraft({ ...draft, tag: event.target.value })}>
              {tagOptions.map(tag => <option value={tag} key={tag}>{tag}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">Description</span>
            <textarea required maxLength={2500} rows={6} className={field} value={draft.description}
              onChange={event => setDraft({ ...draft, description: event.target.value })}
              placeholder="Describe what the characters know about this event." />
            <span className="mt-1 block text-right text-xs text-slate-500">{draft.description.length}/2500</span>
          </label>
          {error && <p role="alert" className="rounded-xl border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>}
          {message && <p role="status" className="rounded-xl border border-green-500/30 bg-green-950/20 p-3 text-sm text-green-200">{message}</p>}
          <button disabled={busy} type="submit" className={button + " w-full border-yellow-600/50 bg-yellow-600/15 text-yellow-100 hover:bg-yellow-600/25"}>
            {busy ? "Saving…" : editingId ? "Save changes" : "Publish event"}
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-yellow-500">Campaign Chronicle</p>
          <h2 className="mt-2 text-xl font-bold text-slate-100">Published events ({entries.length})</h2>
          <p className="mt-1 text-sm text-slate-500">Newest events first. Changes are immediately visible to campaign members.</p>
        </div>
        {entries.length === 0 && <p className="mt-6 text-sm text-slate-400">No events recorded yet.</p>}
        <div className="mt-4 divide-y divide-slate-800">
          {entries.map(entry => (
            <article key={entry.id} className="py-4 first:pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="flex-1 text-sm font-semibold text-slate-100">{entry.title}</h3>
                <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-wider text-slate-400">{entry.tag}</span>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-400">{entry.description}</p>
              <div className="mt-3 flex gap-2">
                <button type="button" disabled={busy} onClick={() => beginEdit(entry)}
                  className={button + " border-slate-600 text-slate-200 hover:border-yellow-600/60"}>Edit</button>
                <button type="button" disabled={busy} onClick={() => void remove(entry)}
                  className={button + " border-red-900/60 text-red-300 hover:border-red-500/60"}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
