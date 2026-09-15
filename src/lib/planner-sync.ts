import {
  type AppState,
  type ChatMessage,
  type FeedbackEntry,
  type InsightCard,
  type PersonaWorkspace,
  plannerSubstanceScore,
  syncActiveWorkspace,
} from "@/lib/store";
import { MAX_SAVED_PERSONAS } from "@/lib/persona";
import type { CalendarPost } from "@/lib/year-calendar";

export type PlannerSyncPlan = {
  /** Paint this snapshot on load / quiet pull. Null = local already matches. */
  applyLocal: AppState | null;
  /** Upload when cloud is missing this snapshot. */
  upload: AppState | null;
};

/** Compare notes/personas without volatile schedule fields. */
export function syncFingerprint(state: AppState): string {
  const flushed = syncActiveWorkspace(state);
  const workspaces = flushed.workspaces
    .map((ws) => ({
      id: ws.id,
      label: ws.label,
      preset: ws.persona.presetId,
      name: ws.persona.name,
      posts: [...ws.posts]
        .sort((a, b) => a.week - b.week || a.indexInWeek - b.indexInWeek || a.id.localeCompare(b.id))
        .map((p) => ({
          id: p.id,
          week: p.week,
          indexInWeek: p.indexInWeek,
          status: p.status,
          titleHint: p.titleHint,
          body: p.draft?.body ?? "",
          titles: p.draft?.titles ?? [],
          extra: p.draft?.extra ?? "",
          materials: p.materials?.length ?? 0,
          publishedAt: p.publishedAt ?? "",
        })),
      insights: [...(ws.insights ?? [])]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((i) => ({
          id: i.id,
          raw: i.raw,
          polished: i.polished,
        })),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify({
    active: flushed.activeWorkspaceId,
    workspaces,
  });
}

function statusRank(status: CalendarPost["status"]): number {
  if (status === "published") return 2;
  if (status === "drafted") return 1;
  return 0;
}

function postWeight(p: CalendarPost): number {
  const body = p.draft?.body?.trim().length ?? 0;
  const extra = p.draft?.extra?.trim().length ?? 0;
  return statusRank(p.status) * 10_000 + (p.materials?.length ?? 0) * 40 + body + extra;
}

function richerPost(a: CalendarPost, b: CalendarPost): CalendarPost {
  return postWeight(a) >= postWeight(b) ? a : b;
}

function mergeById<T extends { id: string }>(left: T[], right: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of left) map.set(item.id, item);
  for (const item of right) {
    if (!map.has(item.id)) map.set(item.id, item);
  }
  return [...map.values()];
}

function mergePostLists(left: CalendarPost[], right: CalendarPost[]): CalendarPost[] {
  const result = new Map<string, CalendarPost>();
  const slotOwner = new Map<string, string>();

  function absorb(post: CalendarPost) {
    const slot = `${post.week}:${post.indexInWeek}`;
    const existing = result.get(post.id);
    if (existing) {
      result.set(post.id, richerPost(existing, post));
      return;
    }
    const ownerId = slotOwner.get(slot);
    if (ownerId && ownerId !== post.id) {
      const occupant = result.get(ownerId);
      if (occupant) {
        const merged = richerPost(occupant, post);
        result.set(ownerId, {
          ...merged,
          id: ownerId,
          week: occupant.week,
          indexInWeek: occupant.indexInWeek,
          weekStart: occupant.weekStart,
        });
        return;
      }
    }
    result.set(post.id, post);
    if (!slotOwner.has(slot)) slotOwner.set(slot, post.id);
  }

  for (const post of left) absorb(post);
  for (const post of right) absorb(post);
  return [...result.values()].sort(
    (a, b) => a.week - b.week || a.indexInWeek - b.indexInWeek,
  );
}

function remapLocalWorkspaces(
  local: PersonaWorkspace[],
  remote: PersonaWorkspace[],
): PersonaWorkspace[] {
  const claimed = new Set<string>();
  return local.map((lw) => {
    if (remote.some((rw) => rw.id === lw.id)) {
      claimed.add(lw.id);
      return lw;
    }
    const match = remote.find(
      (rw) =>
        !claimed.has(rw.id) &&
        rw.persona.presetId === lw.persona.presetId &&
        !local.some((x) => x.id === rw.id),
    );
    if (!match) return lw;
    claimed.add(match.id);
    return { ...lw, id: match.id };
  });
}

function mergeWorkspace(remote: PersonaWorkspace, local: PersonaWorkspace): PersonaWorkspace {
  const posts = mergePostLists(remote.posts, local.posts);
  const insights = mergeById<InsightCard>(remote.insights ?? [], local.insights ?? []);
  const feedback = mergeById<FeedbackEntry>(remote.feedback ?? [], local.feedback ?? []);
  const snapshots = mergeById(remote.snapshots ?? [], local.snapshots ?? []);
  const chat = mergeById<ChatMessage>(remote.chat ?? [], local.chat ?? []).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  const weekMeta = [...remote.weekMeta];
  for (const row of local.weekMeta) {
    if (!weekMeta.some((w) => w.week === row.week)) weekMeta.push(row);
  }
  const localRicher = plannerSubstanceScore({
    version: 4,
    activeWorkspaceId: local.id,
    workspaces: [local],
    persona: local.persona,
    calendarStart: local.calendarStart,
    scheduleAsOf: local.scheduleAsOf,
    posts: local.posts,
    weekMeta: local.weekMeta,
    insights: local.insights,
    feedback: local.feedback,
    weights: local.weights,
    pending: local.pending,
    snapshots: local.snapshots,
    chat: local.chat,
    selectedPostId: local.selectedPostId,
  }) >= plannerSubstanceScore({
    version: 4,
    activeWorkspaceId: remote.id,
    workspaces: [remote],
    persona: remote.persona,
    calendarStart: remote.calendarStart,
    scheduleAsOf: remote.scheduleAsOf,
    posts: remote.posts,
    weekMeta: remote.weekMeta,
    insights: remote.insights,
    feedback: remote.feedback,
    weights: remote.weights,
    pending: remote.pending,
    snapshots: remote.snapshots,
    chat: remote.chat,
    selectedPostId: remote.selectedPostId,
  });
  const selected =
    (localRicher ? local.selectedPostId : remote.selectedPostId) &&
    posts.some((p) => p.id === (localRicher ? local.selectedPostId : remote.selectedPostId))
      ? (localRicher ? local.selectedPostId : remote.selectedPostId)
      : (posts.find((p) => p.id === local.selectedPostId)?.id ??
        posts.find((p) => p.id === remote.selectedPostId)?.id ??
        posts[0]?.id ??
        null);
  return {
    ...(localRicher ? local : remote),
    id: remote.id,
    posts,
    insights,
    feedback,
    snapshots,
    chat,
    weekMeta,
    selectedPostId: selected,
    updatedAt:
      local.updatedAt > remote.updatedAt ? local.updatedAt : remote.updatedAt,
  };
}

/** Union local + remote so two browsers don't wipe each other's notes. */
export function mergePlannerStates(local: AppState, remote: AppState): AppState {
  const localFlushed = syncActiveWorkspace(local);
  const remoteFlushed = syncActiveWorkspace(remote);
  const remappedLocal = remapLocalWorkspaces(
    localFlushed.workspaces,
    remoteFlushed.workspaces,
  );
  const byId = new Map<string, PersonaWorkspace>();
  for (const ws of remoteFlushed.workspaces) byId.set(ws.id, ws);
  for (const ws of remappedLocal) {
    const prev = byId.get(ws.id);
    byId.set(ws.id, prev ? mergeWorkspace(prev, ws) : ws);
  }
  const workspaces = [...byId.values()]
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .slice(0, MAX_SAVED_PERSONAS);
  const remappedActive =
    remappedLocal.find(
      (w, i) => localFlushed.workspaces[i]?.id === localFlushed.activeWorkspaceId,
    )?.id ?? localFlushed.activeWorkspaceId;
  const activeId =
    (remappedActive && workspaces.some((w) => w.id === remappedActive)
      ? remappedActive
      : null) ||
    (remoteFlushed.activeWorkspaceId &&
    workspaces.some((w) => w.id === remoteFlushed.activeWorkspaceId)
      ? remoteFlushed.activeWorkspaceId
      : null) ||
    workspaces[0]?.id ||
    null;
  const next: AppState = {
    version: 4,
    activeWorkspaceId: activeId,
    workspaces,
    persona: remoteFlushed.persona,
    calendarStart: remoteFlushed.calendarStart,
    scheduleAsOf: remoteFlushed.scheduleAsOf,
    posts: [],
    weekMeta: [],
    insights: [],
    feedback: [],
    weights: remoteFlushed.weights,
    pending: remoteFlushed.pending ?? localFlushed.pending,
    snapshots: [],
    chat: [],
    selectedPostId: null,
  };
  return syncActiveWorkspace(next);
}

/**
 * Merge local + cloud, then paint / upload whichever side is missing the union.
 */
export function resolvePlannerSync(
  local: AppState,
  remote: AppState | null,
): PlannerSyncPlan {
  const localFlushed = syncActiveWorkspace(local);
  const localScore = plannerSubstanceScore(localFlushed);
  const remoteFlushed = remote ? syncActiveWorkspace(remote) : null;

  if (!remoteFlushed) {
    return {
      applyLocal: null,
      upload: localScore > 0 ? localFlushed : null,
    };
  }

  const merged = mergePlannerStates(localFlushed, remoteFlushed);
  const mergedFp = syncFingerprint(merged);
  const localFp = syncFingerprint(localFlushed);
  const remoteFp = syncFingerprint(remoteFlushed);
  return {
    applyLocal: mergedFp === localFp ? null : merged,
    upload: mergedFp === remoteFp ? null : merged,
  };
}
