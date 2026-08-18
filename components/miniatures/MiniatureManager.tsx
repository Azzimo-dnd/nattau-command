"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MiniatureViewer, type MiniatureModelInfo } from "./MiniatureViewer";

type RosterRow = {
  player_id: string;
  display_name: string;
  miniature_id: string | null;
  storage_path: string | null;
  original_name: string | null;
  file_size_bytes: number | null;
  triangle_count: number | null;
  width_mm: number | null;
  depth_mm: number | null;
  height_mm: number | null;
  miniature_created_at: string | null;
};

type MiniatureRow = {
  id: string;
  campaign_id: string;
  player_id: string;
  storage_path: string;
  original_name: string;
  format: string;
  file_size_bytes: number;
  triangle_count: number | null;
  width_mm: number | null;
  depth_mm: number | null;
  height_mm: number | null;
  is_current: boolean;
  uploaded_by: string;
  created_at: string;
};

type Candidate = {
  file: File;
  info: MiniatureModelInfo;
};

type Props = {
  campaignId: string;
};

const BUCKET = "character-miniatures";
const MAX_FILE_BYTES = 50 * 1024 * 1024;

function formatBytes(bytes: number | null) {
  if (bytes == null) return "—";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function MiniatureManager({ campaignId }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [history, setHistory] = useState<MiniatureRow[]>([]);
  const [storedFile, setStoredFile] = useState<File | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingModel, setLoadingModel] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedPlayer = useMemo(
    () => roster.find((row) => row.player_id === selectedPlayerId) ?? null,
    [roster, selectedPlayerId],
  );

  const handleLocalFileLoaded = useCallback((file: File, info: MiniatureModelInfo) => {
    setCandidate({ file, info });
    setMessage(null);
    setError(null);
  }, []);

  const refreshRoster = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc("list_campaign_miniature_roster", {
      p_campaign_id: campaignId,
    });
    if (rpcError) throw rpcError;
    const rows = (data ?? []) as RosterRow[];
    setRoster(rows);
    setSelectedPlayerId((current) => {
      if (current && rows.some((row) => row.player_id === current)) return current;
      const pippo = rows.find((row) => row.display_name.trim().toLowerCase() === "pippo");
      return pippo?.player_id ?? rows[0]?.player_id ?? null;
    });
    return rows;
  }, [campaignId, supabase]);

  const refreshHistory = useCallback(async (playerId: string) => {
    const { data, error: queryError } = await supabase
      .from("character_miniatures")
      .select("id,campaign_id,player_id,storage_path,original_name,format,file_size_bytes,triangle_count,width_mm,depth_mm,height_mm,is_current,uploaded_by,created_at")
      .eq("campaign_id", campaignId)
      .eq("player_id", playerId)
      .order("created_at", { ascending: false });
    if (queryError) throw queryError;
    setHistory((data ?? []) as MiniatureRow[]);
  }, [campaignId, supabase]);

  const downloadStoredFile = useCallback(async (path: string, originalName: string) => {
    setLoadingModel(true);
    setError(null);
    const { data, error: downloadError } = await supabase.storage.from(BUCKET).download(path);
    setLoadingModel(false);
    if (downloadError) throw downloadError;
    return new File([data], originalName || "miniature.stl", {
      type: data.type || "application/octet-stream",
    });
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refreshRoster()
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load the miniature roster.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [refreshRoster]);

  useEffect(() => {
    let cancelled = false;
    setCandidate(null);
    setStoredFile(null);
    setMessage(null);
    setError(null);
    setHistory([]);

    if (!selectedPlayerId) return () => { cancelled = true; };

    const current = roster.find((row) => row.player_id === selectedPlayerId);
    void refreshHistory(selectedPlayerId).catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load miniature history.");
    });

    if (current?.storage_path && current.original_name) {
      void downloadStoredFile(current.storage_path, current.original_name)
        .then((file) => {
          if (!cancelled) setStoredFile(file);
        })
        .catch((cause) => {
          if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not download the current miniature.");
        });
    }

    return () => { cancelled = true; };
  }, [downloadStoredFile, refreshHistory, roster, selectedPlayerId]);

  const uploadCandidate = async () => {
    if (!selectedPlayerId || !selectedPlayer || !candidate || uploading) return;
    setError(null);
    setMessage(null);

    if (candidate.file.size > MAX_FILE_BYTES) {
      setError("The STL is larger than the 50 MB miniature limit.");
      return;
    }

    const objectName = `${campaignId}/${selectedPlayerId}/${crypto.randomUUID()}.stl`;
    setUploading(true);

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(objectName, candidate.file, {
      cacheControl: "3600",
      contentType: candidate.file.type || "application/octet-stream",
      upsert: false,
    });

    if (uploadError) {
      setUploading(false);
      setError(uploadError.message);
      return;
    }

    const { error: registerError } = await supabase.rpc("register_character_miniature", {
      p_campaign_id: campaignId,
      p_player_id: selectedPlayerId,
      p_storage_path: objectName,
      p_original_name: candidate.file.name,
      p_file_size_bytes: candidate.file.size,
      p_triangle_count: candidate.info.triangles,
      p_width_mm: candidate.info.width,
      p_depth_mm: candidate.info.depth,
      p_height_mm: candidate.info.height,
    });

    if (registerError) {
      await supabase.storage.from(BUCKET).remove([objectName]);
      setUploading(false);
      setError(registerError.message);
      return;
    }

    setStoredFile(candidate.file);
    setCandidate(null);
    setMessage(`${selectedPlayer.display_name}'s new miniature is now current.`);
    try {
      await Promise.all([refreshRoster(), refreshHistory(selectedPlayerId)]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The model was saved, but the list could not be refreshed.");
    } finally {
      setUploading(false);
    }
  };

  const previewHistory = async (miniature: MiniatureRow) => {
    setBusyId(miniature.id);
    setCandidate(null);
    setError(null);
    try {
      const file = await downloadStoredFile(miniature.storage_path, miniature.original_name);
      setStoredFile(file);
      setMessage(miniature.is_current ? "Showing the current miniature." : `Previewing ${miniature.original_name} from history.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not preview this miniature.");
    } finally {
      setBusyId(null);
    }
  };

  const makeCurrent = async (miniature: MiniatureRow) => {
    if (miniature.is_current || busyId) return;
    setBusyId(miniature.id);
    setError(null);
    setMessage(null);
    const { error: rpcError } = await supabase.rpc("set_character_miniature_current", {
      p_miniature_id: miniature.id,
    });
    if (rpcError) {
      setBusyId(null);
      setError(rpcError.message);
      return;
    }

    try {
      const file = await downloadStoredFile(miniature.storage_path, miniature.original_name);
      setStoredFile(file);
      setCandidate(null);
      await Promise.all([refreshRoster(), refreshHistory(miniature.player_id)]);
      setMessage(`${selectedPlayer?.display_name ?? "Character"}'s previous miniature is current again.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The miniature was changed, but the preview could not be refreshed.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-800 bg-slate-900/65 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-yellow-500">Character assignment</p>
            <h2 className="mt-2 text-2xl font-black text-slate-100">Who owns this miniature?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Pick an active player character, preview an STL, then upload it. The file is stored privately in Supabase and immediately becomes that character&apos;s current miniature.
            </p>
          </div>
          <label className="min-w-[240px] text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            Character
            <select
              value={selectedPlayerId ?? ""}
              disabled={loading || roster.length === 0 || uploading}
              onChange={(event) => setSelectedPlayerId(event.target.value || null)}
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm font-bold normal-case tracking-normal text-slate-200 outline-none focus:border-yellow-500/60"
            >
              {roster.length === 0 ? <option value="">No active players</option> : null}
              {roster.map((row) => (
                <option key={row.player_id} value={row.player_id}>{row.display_name}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {loading ? (
        <div className="h-[620px] animate-pulse rounded-[30px] border border-slate-800 bg-slate-900/50" />
      ) : selectedPlayer ? (
        <>
          <MiniatureViewer
            sourceFile={storedFile}
            allowFilePicker
            emptyTitle={`Choose ${selectedPlayer.display_name}'s STL`}
            emptyCopy="Drop a miniature here or choose an STL. It stays a local preview until you press Upload & set current."
            onLocalFileLoaded={handleLocalFileLoaded}
          />

          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-[28px] border border-slate-800 bg-slate-900/65 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Pending upload</p>
                  <h3 className="mt-2 text-xl font-black text-slate-100">
                    {candidate ? candidate.file.name : "No new STL selected"}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {candidate
                      ? `${formatBytes(candidate.file.size)} · ${candidate.info.triangles.toLocaleString()} triangles · ${candidate.info.height.toFixed(1)} mm high`
                      : "The viewer may be showing the stored current model. Choose another STL only when you want to create a new version."}
                  </p>
                </div>
                {candidate ? (
                  <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-yellow-300">Local only</span>
                ) : null}
              </div>

              <button
                type="button"
                disabled={!candidate || uploading}
                onClick={() => void uploadCandidate()}
                className="mt-5 min-h-12 w-full rounded-xl bg-yellow-500 px-5 text-sm font-black text-slate-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-30 sm:w-auto"
              >
                {uploading ? "Uploading miniature…" : "Upload & set current"}
              </button>
              <p className="mt-3 text-[11px] leading-5 text-slate-600">
                Private bucket · 50 MB maximum · v1 stores the original STL. Large files can take a moment to upload on slower connections.
              </p>
            </div>

            <div className="rounded-[28px] border border-slate-800 bg-slate-900/65 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-yellow-500">Current model</p>
              <h3 className="mt-2 text-xl font-black text-slate-100">{selectedPlayer.original_name ?? "None assigned"}</h3>
              {selectedPlayer.miniature_id ? (
                <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl border border-slate-800 bg-black/15 p-3"><dt className="text-slate-600">Size</dt><dd className="mt-1 font-bold text-slate-300">{formatBytes(selectedPlayer.file_size_bytes)}</dd></div>
                  <div className="rounded-xl border border-slate-800 bg-black/15 p-3"><dt className="text-slate-600">Triangles</dt><dd className="mt-1 font-bold text-slate-300">{selectedPlayer.triangle_count?.toLocaleString() ?? "—"}</dd></div>
                </dl>
              ) : (
                <p className="mt-3 text-xs leading-5 text-slate-500">Upload the first STL to give {selectedPlayer.display_name} a current miniature.</p>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-800 bg-slate-900/65 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Version history</p>
                <h3 className="mt-2 text-xl font-black text-slate-100">{selectedPlayer.display_name}&apos;s miniatures</h3>
              </div>
              <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-bold text-slate-500">{history.length} saved</span>
            </div>

            {history.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">No saved miniature versions yet.</p>
            ) : (
              <div className="mt-4 grid gap-2">
                {history.map((miniature) => (
                  <div key={miniature.id} className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/35 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-black text-slate-200">{miniature.original_name}</p>
                        {miniature.is_current ? <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-300">Current</span> : null}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-600">{formatDate(miniature.created_at)} · {formatBytes(miniature.file_size_bytes)} · {miniature.triangle_count?.toLocaleString() ?? "?"} triangles</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={busyId === miniature.id || loadingModel} onClick={() => void previewHistory(miniature)} className="min-h-9 rounded-xl border border-slate-700 px-3 text-[11px] font-bold text-slate-300 disabled:opacity-30">Preview</button>
                      {!miniature.is_current ? (
                        <button type="button" disabled={busyId === miniature.id} onClick={() => void makeCurrent(miniature)} className="min-h-9 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 text-[11px] font-black text-cyan-200 disabled:opacity-30">Set current</button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        <div className="rounded-[30px] border border-slate-800 bg-slate-900/60 p-10 text-center text-slate-500">No active player characters are available in this campaign.</div>
      )}

      {loadingModel ? <p className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-xs text-cyan-200">Downloading miniature from private storage…</p> : null}
      {error ? <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{error}</p> : null}
      {message ? <p className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">{message}</p> : null}
    </div>
  );
}
