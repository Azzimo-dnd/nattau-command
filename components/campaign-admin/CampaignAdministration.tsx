"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getCampaignAdminPresentation } from "@/lib/campaigns/campaignAdminPresentation";
import type {
  CampaignAdminMember,
  CampaignInviteSummary,
  CreatedCampaignInvite,
} from "./adminTypes";

type CampaignAdministrationProps = {
  campaignId: string;
  campaignSlug: string;
  companionName: string;
  themeKey: string;
  currentUserId: string;
  initialMembers: CampaignAdminMember[];
  initialInvites: CampaignInviteSummary[];
};

type TabKey = "members" | "invites";

type MemberDraft = {
  role: "dm" | "player";
  planningEnabled: boolean;
  countsTowardProgress: boolean;
  isTestAccount: boolean;
  isActive: boolean;
};

function formatDate(value: string | null, withTime = false) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime
      ? {
          hour: "2-digit" as const,
          minute: "2-digit" as const,
        }
      : {}),
  }).format(date);
}

function inviteStatus(invite: CampaignInviteSummary) {
  if (!invite.isActive) return "Revoked";
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
    return "Expired";
  }
  if (invite.maxUses !== null && invite.usesCount >= invite.maxUses) {
    return "Used";
  }
  return "Active";
}

function statusClass(status: string) {
  switch (status) {
    case "Active":
      return "border-emerald-700/50 bg-emerald-900/20 text-emerald-300";
    case "Used":
      return "border-amber-700/50 bg-amber-900/20 text-amber-300";
    default:
      return "border-slate-700 bg-black/20 text-slate-400";
  }
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

function Toggle({
  checked,
  onChange,
  label,
  description,
  themeKey,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
  themeKey: string;
  disabled?: boolean;
}) {
  const theme = getCampaignAdminPresentation("", themeKey, "Campaign");

  return (
    <label
      className={`flex items-start justify-between gap-4 rounded-2xl border p-4 ${theme.panelSoft} ${
        disabled ? "opacity-55" : "cursor-pointer"
      }`}
    >
      <span>
        <span className={`block text-sm font-semibold ${theme.mainText}`}>
          {label}
        </span>
        <span className={`mt-1 block text-xs leading-5 ${theme.mutedText}`}>
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-current"
      />
    </label>
  );
}

function MemberEditor({
  member,
  campaignId,
  campaignSlug,
  companionName,
  themeKey,
  currentUserId,
  onClose,
  onSaved,
}: {
  member: CampaignAdminMember;
  campaignId: string;
  campaignSlug: string;
  companionName: string;
  themeKey: string;
  currentUserId: string;
  onClose: () => void;
  onSaved: (draft: MemberDraft) => void;
}) {
  const theme = getCampaignAdminPresentation(
    campaignSlug,
    themeKey,
    companionName
  );
  const [draft, setDraft] = useState<MemberDraft>({
    role: member.role,
    planningEnabled: member.planningEnabled,
    countsTowardProgress: member.countsTowardProgress,
    isTestAccount: member.isTestAccount,
    isActive: member.isActive,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isSelf = member.userId === currentUserId;

  async function persist() {
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("update_campaign_member_admin", {
      p_campaign_id: campaignId,
      p_user_id: member.userId,
      p_role: draft.role,
      p_planning_enabled: draft.planningEnabled,
      p_counts_toward_progress: draft.countsTowardProgress,
      p_is_test_account: draft.isTestAccount,
      p_is_active: draft.isActive,
    } as never);

    if (error) {
      setMessage(error.message);
      return;
    }

    onSaved(draft);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close member editor"
        onClick={onClose}
        className="absolute inset-0"
      />
      <section
        className={`${theme.panel} relative z-10 max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-b-none p-5 sm:rounded-[26px] sm:p-6`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className={`text-[10px] font-bold uppercase tracking-[0.28em] ${theme.accentText}`}
            >
              Campaign member
            </p>
            <h2 className={`mt-2 font-serif text-2xl font-black ${theme.mainText}`}>
              {member.displayName}
            </h2>
            {member.email && (
              <p className={`mt-1 text-sm ${theme.mutedText}`}>{member.email}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`flex h-10 w-10 items-center justify-center rounded-xl border ${theme.secondaryButton}`}
          >
            ×
          </button>
        </div>

        <div className="mt-6 space-y-3">
          <label className={`block rounded-2xl border p-4 ${theme.panelSoft}`}>
            <span className={`text-sm font-semibold ${theme.mainText}`}>
              Campaign role
            </span>
            <select
              value={draft.role}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  role: event.target.value === "dm" ? "dm" : "player",
                }))
              }
              className={`mt-3 w-full rounded-xl border px-3 py-3 text-sm outline-none ${theme.input}`}
            >
              <option value="player">Player</option>
              <option value="dm">Game Master</option>
            </select>
            <span className={`mt-2 block text-xs leading-5 ${theme.mutedText}`}>
              Invitation codes can only create Players. GM access must be granted here.
            </span>
          </label>

          <Toggle
            checked={draft.planningEnabled}
            onChange={(planningEnabled) =>
              setDraft((current) => ({ ...current, planningEnabled }))
            }
            label="Included in session planning"
            description="Counts this player in availability totals and favourable-date calculations."
            themeKey={themeKey}
          />
          <Toggle
            checked={draft.countsTowardProgress}
            onChange={(countsTowardProgress) =>
              setDraft((current) => ({ ...current, countsTowardProgress }))
            }
            label="Included in campaign progress"
            description="Counts this account in dashboards, omens and future party progress totals."
            themeKey={themeKey}
          />
          <Toggle
            checked={draft.isTestAccount}
            onChange={(isTestAccount) =>
              setDraft((current) => ({ ...current, isTestAccount }))
            }
            label="Test account"
            description="Marks the profile as a testing identity. It does not remove access by itself."
            themeKey={themeKey}
          />
          <Toggle
            checked={draft.isActive}
            onChange={(isActive) =>
              setDraft((current) => ({ ...current, isActive }))
            }
            label="Campaign access active"
            description={
              isSelf
                ? "You can deactivate yourself only when another active GM remains in this campaign."
                : "Turning this off removes access to this campaign without deleting the account or its history."
            }
            themeKey={themeKey}
          />
        </div>

        {message && (
          <p className="mt-4 rounded-xl border border-red-800/50 bg-red-950/25 px-4 py-3 text-sm text-red-300">
            {message}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className={`min-h-11 rounded-xl border px-4 text-sm font-semibold ${theme.secondaryButton}`}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => persist())}
            className={`min-h-11 rounded-xl border px-5 text-sm font-bold disabled:opacity-50 ${theme.primaryButton}`}
          >
            {isPending ? "Saving…" : "Save member"}
          </button>
        </div>
      </section>
    </div>
  );
}

export function CampaignAdministration({
  campaignId,
  campaignSlug,
  companionName,
  themeKey,
  currentUserId,
  initialMembers,
  initialInvites,
}: CampaignAdministrationProps) {
  const router = useRouter();
  const theme = getCampaignAdminPresentation(
    campaignSlug,
    themeKey,
    companionName
  );
  const [tab, setTab] = useState<TabKey>("members");
  const [members, setMembers] = useState(initialMembers);
  const [invites, setInvites] = useState(initialInvites);
  const [editingMember, setEditingMember] =
    useState<CampaignAdminMember | null>(null);
  const [label, setLabel] = useState("Main party");
  const [maxUses, setMaxUses] = useState("1");
  const [expiryDays, setExpiryDays] = useState("14");
  const [planningEnabled, setPlanningEnabled] = useState(true);
  const [countsTowardProgress, setCountsTowardProgress] = useState(true);
  const [createdInvite, setCreatedInvite] =
    useState<CreatedCampaignInvite | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeMembers = useMemo(
    () => members.filter((member) => member.isActive).length,
    [members]
  );
  const playerCount = useMemo(
    () =>
      members.filter(
        (member) => member.role === "player" && member.isActive
      ).length,
    [members]
  );
  const activeInvites = useMemo(
    () => invites.filter((invite) => inviteStatus(invite) === "Active").length,
    [invites]
  );

  function refresh() {
    router.refresh();
  }

  async function createInvite() {
    setNotice(null);
    setCreatedInvite(null);
    const supabase = createClient();
    const parsedMaxUses = maxUses === "unlimited" ? null : Number(maxUses);
    const parsedExpiry = expiryDays === "never" ? null : Number(expiryDays);

    const { data, error } = await supabase.rpc("create_campaign_invite", {
      p_campaign_id: campaignId,
      p_label: label.trim() || null,
      p_max_uses: parsedMaxUses,
      p_expires_in_days: parsedExpiry,
      p_planning_enabled: planningEnabled,
      p_counts_toward_progress: countsTowardProgress,
    } as never);

    if (error) {
      setNotice(error.message);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== "object") {
      setNotice("The invitation was created, but its code could not be displayed.");
      refresh();
      return;
    }

    const record = row as Record<string, unknown>;
    const newInvite: CreatedCampaignInvite = {
      inviteId: String(record.invite_id ?? ""),
      inviteCode: String(record.invite_code ?? ""),
      invitePath: String(record.invite_path ?? ""),
      expiresAt:
        typeof record.expires_at === "string" ? record.expires_at : null,
    };

    setCreatedInvite(newInvite);
    setInvites((current) => [
      {
        id: newInvite.inviteId,
        label:
          typeof record.invite_label === "string" ? record.invite_label : null,
        codePreview:
          typeof record.code_preview === "string" ? record.code_preview : "••••",
        role: "player",
        planningEnabled: record.planning_enabled !== false,
        countsTowardProgress: record.counts_toward_progress !== false,
        maxUses:
          record.max_uses === null || record.max_uses === undefined
            ? null
            : Number(record.max_uses),
        usesCount: Number(record.uses_count ?? 0),
        expiresAt: newInvite.expiresAt,
        isActive: true,
        createdAt:
          typeof record.created_at === "string"
            ? record.created_at
            : new Date().toISOString(),
        createdByName: null,
      },
      ...current,
    ]);
    setNotice("Invitation created. Copy it now — the full code is shown only once.");
  }

  async function revokeInvite(inviteId: string) {
    setNotice(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("revoke_campaign_invite", {
      p_invite_id: inviteId,
    } as never);

    if (error) {
      setNotice(error.message);
      return;
    }

    setInvites((current) =>
      current.map((invite) =>
        invite.id === inviteId ? { ...invite, isActive: false } : invite
      )
    );
    setNotice("Invitation revoked.");
  }

  const inviteUrl = createdInvite
    ? `${typeof window === "undefined" ? "" : window.location.origin}${createdInvite.invitePath}`
    : "";

  return (
    <section>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Active members", activeMembers],
          ["Players", playerCount],
          ["Active invitations", activeInvites],
        ].map(([labelText, value]) => (
          <div key={String(labelText)} className={`${theme.panel} p-5`}>
            <p className={`text-xs uppercase tracking-[0.2em] ${theme.faintText}`}>
              {labelText}
            </p>
            <p className={`mt-2 text-3xl font-black ${theme.mainText}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className={`mt-6 flex rounded-2xl border bg-black/20 p-1 ${theme.border}`}>
        {([
          ["members", "Members"],
          ["invites", "Invitations"],
        ] as const).map(([key, text]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`min-h-11 flex-1 rounded-xl px-4 text-sm font-bold transition ${
              tab === key ? theme.tabActive : theme.tabInactive
            }`}
          >
            {text}
          </button>
        ))}
      </div>

      {notice && (
        <p className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${theme.notice}`}>
          {notice}
        </p>
      )}

      {tab === "members" ? (
        <div className="mt-5 space-y-3">
          {members.map((member) => (
            <article key={member.userId} className={`${theme.panel} p-5`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className={`truncate text-lg font-bold ${theme.mainText}`}>
                      {member.displayName}
                    </h3>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${theme.roleBadge}`}
                    >
                      {member.role === "dm" ? "Game Master" : "Player"}
                    </span>
                    {member.isTestAccount && (
                      <span className="rounded-full border border-amber-700/40 bg-amber-900/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300">
                        Test account
                      </span>
                    )}
                    {!member.isActive && (
                      <span className="rounded-full border border-red-800/40 bg-red-950/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-red-300">
                        Access disabled
                      </span>
                    )}
                  </div>
                  {member.email && (
                    <p className={`mt-1 truncate text-sm ${theme.mutedText}`}>
                      {member.email}
                    </p>
                  )}
                  <div className={`mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs ${theme.faintText}`}>
                    <span>Joined {formatDate(member.joinedAt)}</span>
                    <span>Last seen {formatDate(member.lastSeenAt, true)}</span>
                    <span>
                      {member.planningEnabled
                        ? "Planning included"
                        : "Planning excluded"}
                    </span>
                    <span>
                      {member.countsTowardProgress
                        ? "Progress included"
                        : "Progress excluded"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingMember(member)}
                  className={`min-h-11 shrink-0 rounded-xl border px-4 text-sm font-bold transition ${theme.secondaryButton}`}
                >
                  Edit member
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className={`${theme.panel} p-5 sm:p-6`}>
            <p
              className={`text-xs font-bold uppercase tracking-[0.28em] ${theme.accentText}`}
            >
              {theme.createEyebrow}
            </p>
            <h2 className={`mt-3 font-serif text-2xl font-black ${theme.mainText}`}>
              Create invitation
            </h2>
            <p className={`mt-2 text-sm leading-6 ${theme.mutedText}`}>
              The invited person creates their own account and chooses their own password. Codes always grant Player access to this campaign only.
            </p>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className={`text-sm font-semibold ${theme.mainText}`}>
                  Label
                </span>
                <input
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  maxLength={80}
                  placeholder="Main party, guest player…"
                  className={`mt-2 w-full rounded-xl border px-4 py-3 outline-none ${theme.input}`}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={`text-sm font-semibold ${theme.mainText}`}>
                    Maximum uses
                  </span>
                  <select
                    value={maxUses}
                    onChange={(event) => setMaxUses(event.target.value)}
                    className={`mt-2 w-full rounded-xl border px-4 py-3 outline-none ${theme.input}`}
                  >
                    <option value="1">1 use</option>
                    <option value="2">2 uses</option>
                    <option value="5">5 uses</option>
                    <option value="10">10 uses</option>
                    <option value="unlimited">Unlimited</option>
                  </select>
                </label>
                <label className="block">
                  <span className={`text-sm font-semibold ${theme.mainText}`}>
                    Expires
                  </span>
                  <select
                    value={expiryDays}
                    onChange={(event) => setExpiryDays(event.target.value)}
                    className={`mt-2 w-full rounded-xl border px-4 py-3 outline-none ${theme.input}`}
                  >
                    <option value="1">After 1 day</option>
                    <option value="7">After 7 days</option>
                    <option value="14">After 14 days</option>
                    <option value="30">After 30 days</option>
                    <option value="90">After 90 days</option>
                    <option value="never">Never</option>
                  </select>
                </label>
              </div>

              <Toggle
                checked={planningEnabled}
                onChange={setPlanningEnabled}
                label="Include in session planning"
                description="Recommended for normal campaign players."
                themeKey={themeKey}
              />
              <Toggle
                checked={countsTowardProgress}
                onChange={setCountsTowardProgress}
                label="Include in campaign progress"
                description="Recommended for normal players and disabled for test accounts."
                themeKey={themeKey}
              />

              <button
                type="button"
                disabled={isPending}
                onClick={() => startTransition(() => createInvite())}
                className={`min-h-12 w-full rounded-xl border px-5 text-sm font-black shadow-lg shadow-black/20 disabled:opacity-50 ${theme.primaryButton}`}
              >
                {isPending ? theme.createPendingLabel : "Generate invitation code"}
              </button>
            </div>

            {createdInvite && (
              <div className={`mt-6 rounded-[22px] border p-5 ${theme.codeBox}`}>
                <p
                  className={`text-[10px] font-bold uppercase tracking-[0.25em] ${theme.accentText}`}
                >
                  Copy now — shown once
                </p>
                <code
                  className={`mt-3 block break-all rounded-xl border bg-black/25 px-3 py-3 text-center text-sm font-black tracking-[0.08em] sm:text-base ${theme.border} ${theme.mainText}`}
                >
                  {createdInvite.inviteCode}
                </code>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => copyText(createdInvite.inviteCode)}
                    className={`min-h-11 rounded-xl border px-3 text-sm font-bold ${theme.secondaryButton}`}
                  >
                    Copy code
                  </button>
                  <button
                    type="button"
                    onClick={() => copyText(inviteUrl)}
                    className={`min-h-11 rounded-xl border px-3 text-sm font-bold ${theme.secondaryButton}`}
                  >
                    Copy invitation link
                  </button>
                </div>
                {createdInvite.expiresAt && (
                  <p className={`mt-3 text-center text-xs ${theme.mutedText}`}>
                    Expires {formatDate(createdInvite.expiresAt, true)}
                  </p>
                )}
              </div>
            )}
          </section>

          <section className={`${theme.panel} p-5 sm:p-6`}>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p
                  className={`text-xs font-bold uppercase tracking-[0.28em] ${theme.accentText}`}
                >
                  Invitation registry
                </p>
                <h2
                  className={`mt-3 font-serif text-2xl font-black ${theme.mainText}`}
                >
                  Existing invitations
                </h2>
              </div>
              <span className={`text-sm ${theme.faintText}`}>
                {invites.length} total
              </span>
            </div>

            <div className="mt-6 space-y-3">
              {invites.length === 0 ? (
                <p
                  className={`rounded-2xl border border-dashed px-4 py-8 text-center text-sm ${theme.border} ${theme.faintText}`}
                >
                  No invitation has been created yet.
                </p>
              ) : (
                invites.map((invite) => {
                  const status = inviteStatus(invite);
                  return (
                    <article
                      key={invite.id}
                      className={`rounded-2xl border p-4 ${theme.panelSoft}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className={`font-bold ${theme.mainText}`}>
                            {invite.label || "Player invitation"}
                          </p>
                          <p
                            className={`mt-1 font-mono text-xs tracking-[0.08em] ${theme.mutedText}`}
                          >
                            {invite.codePreview}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${statusClass(
                            status
                          )}`}
                        >
                          {status}
                        </span>
                      </div>
                      <div
                        className={`mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs ${theme.faintText}`}
                      >
                        <span>
                          {invite.usesCount}/{invite.maxUses ?? "∞"} uses
                        </span>
                        <span>
                          {invite.expiresAt
                            ? `Expires ${formatDate(invite.expiresAt)}`
                            : "No expiry"}
                        </span>
                        <span>
                          {invite.planningEnabled
                            ? "Planning on"
                            : "Planning off"}
                        </span>
                        <span>
                          {invite.countsTowardProgress
                            ? "Progress on"
                            : "Progress off"}
                        </span>
                      </div>
                      {status === "Active" && (
                        <button
                          type="button"
                          onClick={() =>
                            startTransition(() => revokeInvite(invite.id))
                          }
                          className={`mt-4 min-h-10 rounded-xl border px-3 text-xs font-bold ${theme.dangerButton}`}
                        >
                          Revoke invitation
                        </button>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}

      {editingMember && (
        <MemberEditor
          member={editingMember}
          campaignId={campaignId}
          campaignSlug={campaignSlug}
          companionName={companionName}
          themeKey={themeKey}
          currentUserId={currentUserId}
          onClose={() => setEditingMember(null)}
          onSaved={(draft) => {
            setMembers((current) =>
              current.map((member) =>
                member.userId === editingMember.userId
                  ? {
                      ...member,
                      role: draft.role,
                      planningEnabled: draft.planningEnabled,
                      countsTowardProgress: draft.countsTowardProgress,
                      isTestAccount: draft.isTestAccount,
                      isActive: draft.isActive,
                    }
                  : member
              )
            );
            refresh();
          }}
        />
      )}
    </section>
  );
}
