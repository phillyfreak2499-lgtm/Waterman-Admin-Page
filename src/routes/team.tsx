import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAccess } from "@/components/access-provider";
import { AuthGate } from "@/components/auth-gate";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Initials } from "@/components/ui/field";
import {
  accessLabel,
  assignAccess,
  assignableRoles,
  type AccessRole,
} from "@/lib/access";
import { assignTraining, getTeam, groupTeam, revokeTraining, type TeamMember, type TeamSnapshot } from "@/lib/org";
import { listTeamEvalStatus } from "@/lib/presentation-eval";
import { listTeamQuadActivity, type TeamQuadActivity } from "@/lib/quad-scores";

export const Route = createFileRoute("/team")({ component: TeamPage });

function TeamPage() {
  return (
    <SiteShell>
      <AuthGate>
        <TeamDesk />
      </AuthGate>
    </SiteShell>
  );
}

function TeamDesk() {
  const { access, ready } = useAccess();
  const [snap, setSnap] = useState<TeamSnapshot | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [evalStatus, setEvalStatus] = useState<Awaited<ReturnType<typeof listTeamEvalStatus>> | null>(null);
  const [quad, setQuad] = useState<Record<string, TeamQuadActivity>>({});

  useEffect(() => {
    if (!ready || !access.canManagePeople) return;
    let cancelled = false;
    setError(null);
    getTeam()
      .then((next) => {
        if (!cancelled) setSnap(next);
      })
      .catch((err) => {
        if (!cancelled) {
          setSnap(null);
          setError(err instanceof Error ? err.message : "Could not load the team");
        }
      });
    listTeamEvalStatus()
      .then((s) => {
        if (!cancelled) setEvalStatus(s);
      })
      .catch(() => {
        if (!cancelled) setEvalStatus(null);
      });
    listTeamQuadActivity()
      .then((s) => {
        if (!cancelled) setQuad(s.byPerson);
      })
      .catch(() => {
        if (!cancelled) setQuad({});
      });
    return () => {
      cancelled = true;
    };
  }, [ready, access.canManagePeople, access.userId, reloadKey]);

  if (!ready) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-16">
        <div className="h-40 animate-pulse rounded-md bg-navy/5" />
      </div>
    );
  }

  if (!access.canManagePeople) {
    return (
      <div className="mx-auto max-w-xl px-5 py-20">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-brass">Team</p>
        <h1 className="mt-3 font-display text-4xl leading-none">This desk is for leaders.</h1>
        <p className="mt-4 text-muted">
          Managers see their Specialists. Regional managers see the managers under them.
          Professor, Sales Manager, and CEO see the whole company.
        </p>
        <Button asChild className="mt-8">
          <Link to="/training">Back to campus</Link>
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-5 py-20">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-brass">Team</p>
        <h1 className="mt-3 font-display text-4xl leading-none">The roster did not load.</h1>
        <p className="mt-4 text-muted">{error}</p>
        <Button type="button" className="mt-7" onClick={() => setReloadKey((key) => key + 1)}>
          Try again
        </Button>
      </div>
    );
  }

  if (!snap) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-16">
        <div className="h-40 animate-pulse rounded-md bg-navy/5" />
      </div>
    );
  }

  const filtered = snap.people.filter((p) => {
    const hay = `${p.name} ${p.email} ${p.store ?? ""} ${p.roleLabel}`.toLowerCase();
    return hay.includes(query.trim().toLowerCase());
  });
  const groups = groupTeam(filtered, snap.viewerId);
  const placed = snap.people.filter((p) => p.role !== "pending");
  const avg = placed.length
    ? Math.round(placed.reduce((n, p) => n + p.pct, 0) / placed.length)
    : 0;
  const waiting = snap.people.filter((p) => p.role === "pending").length;

  return (
    <div className="mx-auto max-w-6xl overflow-x-hidden px-5 py-10 sm:px-8 sm:py-14">
      <p className="kicker">
        {accessLabel(access.role)}
      </p>
      <span className="rule-brass mt-3" />
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl leading-none sm:text-5xl">{snap.title}</h1>
          <p className="mt-4 max-w-xl text-muted">
            See who has finished their path. Assign the next course to anyone under you.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/team/health">Training Health</Link>
          </Button>
          <input
            className="field-input sm:max-w-xs"
            placeholder="Search the roster"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="On your desk" value={String(snap.people.length)} />
        <Stat label="Waiting on a role" value={String(waiting)} />
        <Stat label="Average complete" value={placed.length ? `${avg}%` : "—"} />
        <Stat
          label="Needs eval this week"
          value={String(evalStatus?.needsThisWeek.length ?? "—")}
        />
      </div>

      <div className="mt-10 space-y-10">
        {groups.map((group) => (
          <section key={group.label}>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="font-display text-3xl leading-none">{group.label}</h2>
                {group.lead && (
                  <p className="mt-1 text-sm text-muted">
                    {group.lead.roleLabel}
                    {group.lead.store ? ` · ${group.lead.store}` : ""} · {group.lead.done}/
                    {group.lead.total} lessons
                  </p>
                )}
              </div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted">
                {group.members.length + (group.lead ? 1 : 0)} people
              </p>
            </div>
            <div className="grid gap-4">
              {group.lead && (
                <PersonCard
                  person={group.lead}
                  tracks={snap.tracks}
                  viewerRole={access.role}
                  viewerId={access.userId}
                  onChange={setSnap}
                  needsEval={evalStatus?.needsThisWeek.includes(group.lead.id)}
                  evalInfo={evalStatus?.byPerson[group.lead.id]}
                  quadInfo={quad[group.lead.id]}
                />
              )}
              {group.members.map((person) => (
                <PersonCard
                  key={person.id}
                  person={person}
                  tracks={snap.tracks}
                  viewerRole={access.role}
                  viewerId={access.userId}
                  onChange={setSnap}
                  needsEval={evalStatus?.needsThisWeek.includes(person.id)}
                  evalInfo={evalStatus?.byPerson[person.id]}
                  quadInfo={quad[person.id]}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {!filtered.length && (
        <p className="mt-10 text-sm text-muted">No one matches that search.</p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-5 py-4 shadow-card">
      <p className="kicker text-muted">{label}</p>
      <p className="mt-2 font-display text-4xl leading-none">{value}</p>
    </div>
  );
}

function PersonCard({
  person,
  tracks,
  viewerRole,
  viewerId,
  onChange,
  needsEval,
  evalInfo,
  quadInfo,
}: {
  person: TeamMember;
  tracks: TeamSnapshot["tracks"];
  viewerRole: AccessRole;
  viewerId: string;
  onChange: (snap: TeamSnapshot) => void;
  needsEval?: boolean;
  evalInfo?: {
    lastEvalDate: string | null;
    lastEvalId: string | null;
    overallAvg: number | null;
    phaseAvgs: { id: string; label: string; avg: number | null }[];
    evalCount: number;
  } | null;
  quadInfo?: TeamQuadActivity;
}) {
  const [open, setOpen] = useState(false);
  const [trackId, setTrackId] = useState(tracks[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [busy, setBusy] = useState(false);
  const canPlace = assignableRoles(viewerRole).includes(person.role) || person.role === "pending";

  useEffect(() => {
    if (!tracks.some((track) => track.id === trackId)) {
      setTrackId(tracks[0]?.id ?? "");
    }
  }, [tracks, trackId]);

  async function assignCourse() {
    if (!trackId) return;
    setBusy(true);
    try {
      onChange(await assignTraining({ data: { userId: person.id, trackId, note, dueOn } }));
      setNote("");
      toast.success(`Assigned to ${person.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not assign");
    } finally {
      setBusy(false);
    }
  }

  async function claim() {
    setBusy(true);
    try {
      const role: AccessRole = person.role === "pending" ? "specialist" : person.role;
      await assignAccess({
        data: { userId: person.id, role, store: person.store ?? undefined, reportsTo: viewerId },
      });
      onChange(await getTeam());
      toast.success(`${person.name} is on your team`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not place");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface p-5 shadow-card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <Initials name={person.name} />
            <h3 className="font-display text-2xl leading-none">{person.name}</h3>
            <span className="rounded-sm bg-paper-2 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted">
              {person.roleLabel}
            </span>
            {needsEval && (
              <span className="rounded-sm bg-brass/15 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-brass">
                Needs eval this week
              </span>
            )}
          </div>
          <p className="mt-2 truncate text-sm text-muted">
            {person.email}
            {person.store ? ` · ${person.store}` : ""}
            {person.reportsToName ? ` · reports to ${person.reportsToName}` : ""}
          </p>
        </div>
        <p className="shrink-0 text-sm tabular-nums text-muted">
          {person.total ? `${person.done}/${person.total}` : "—"}
        </p>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full bg-navy" style={{ width: `${person.pct}%` }} />
      </div>
      <p className="mt-2 text-sm text-muted">
        {person.role === "pending"
          ? "Waiting on a role."
          : person.next
            ? `Next: ${person.next.title}`
            : person.total
              ? "Path complete."
              : "No courses on this path yet."}
      </p>

      {person.assignments.length > 0 && (
        <ul className="mt-4 space-y-2">
          {person.assignments.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-sm bg-paper-2 px-3 py-2 text-sm"
            >
              <span>
                Assigned: <span className="font-medium">{item.trackTitle}</span>
                {item.dueOn ? ` · due ${item.dueOn}` : ""}
              </span>
              <button
                type="button"
                className="text-xs uppercase tracking-[0.12em] text-muted hover:text-navy"
                onClick={() => {
                  void revokeTraining({ data: { assignmentId: item.id } })
                    .then(onChange)
                    .catch((err) => toast.error(err instanceof Error ? err.message : "Could not remove"));
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {quadInfo && quadInfo.plays > 0 && (
        <div className="mt-4 rounded-md border border-line bg-paper px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">
              The Quad · {quadInfo.games} game{quadInfo.games === 1 ? "" : "s"} · {quadInfo.plays} play
              {quadInfo.plays === 1 ? "" : "s"}
              {quadInfo.lastPlayedAt ? ` · last ${quadInfo.lastPlayedAt.slice(0, 10)}` : ""}
            </p>
            {quadInfo.lastTitle && (
              <span className="text-[0.65rem] uppercase tracking-[0.12em] text-muted">
                {quadInfo.lastTitle}
              </span>
            )}
          </div>
          {quadInfo.bestTitle && quadInfo.bestScore != null && (
            <p className="mt-1.5 text-[0.7rem] text-muted">
              Best · {quadInfo.bestTitle} {quadInfo.bestScore}
            </p>
          )}
        </div>
      )}

      {evalInfo && evalInfo.evalCount > 0 && (
        <div className="mt-4 rounded-md border border-line bg-paper px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">
              Presentation · last {evalInfo.lastEvalDate || "—"}
              {evalInfo.overallAvg != null ? ` · avg ${evalInfo.overallAvg}/10` : ""}
            </p>
            {evalInfo.lastEvalId && (
              <Link
                to="/team/evaluate/brief/$evalId"
                params={{ evalId: evalInfo.lastEvalId }}
                className="text-[0.65rem] uppercase tracking-[0.12em] text-brass hover:text-navy"
              >
                Open brief
              </Link>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {evalInfo.phaseAvgs
              .filter((p) => p.avg != null)
              .map((p) => (
                <span
                  key={p.id}
                  className={
                    (p.avg ?? 10) < 7
                      ? "rounded-sm bg-brass/15 px-2 py-0.5 text-[0.65rem] tabular-nums text-brass"
                      : "rounded-sm bg-navy/5 px-2 py-0.5 text-[0.65rem] tabular-nums text-muted"
                  }
                >
                  {p.label} {p.avg}
                </span>
              ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {canPlace && !person.reportsTo && person.role !== "admin" && (
          <Button type="button" variant="outline" disabled={busy} onClick={() => void claim()}>
            Add to my team
          </Button>
        )}
        {person.role !== "pending" && person.role !== "admin" && (
          <Button asChild variant="outline">
            <Link to="/team/evaluate/$userId" params={{ userId: person.id }}>
              Evaluate presentation
            </Link>
          </Button>
        )}
        {person.role !== "pending" && (
          <Button type="button" variant="outline" onClick={() => setOpen((v) => !v)}>
            {open ? "Close" : "Assign training"}
          </Button>
        )}
      </div>

      {open && (
        <div className="mt-4 grid min-w-0 gap-3 rounded-md border border-line bg-paper p-4 sm:grid-cols-[1fr_8rem_auto]">
          <select
            className="h-11 min-w-0 rounded-sm border border-line bg-surface px-3"
            value={trackId}
            onChange={(e) => setTrackId(e.target.value)}
            disabled={!tracks.length}
          >
            {!tracks.length && <option value="">No courses available</option>}
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="h-11 min-w-0 rounded-sm border border-line bg-surface px-3"
            value={dueOn}
            onChange={(e) => setDueOn(e.target.value)}
          />
          <Button type="button" disabled={busy || !trackId} onClick={() => void assignCourse()}>
            {busy ? "Saving…" : "Assign"}
          </Button>
          <input
            className="h-11 min-w-0 rounded-sm border border-line bg-surface px-3 sm:col-span-3"
            placeholder="Optional note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      )}
    </article>
  );
}
