import {
  type AppState,
  plannerSubstanceScore,
  syncActiveWorkspace,
} from "@/lib/store";

export type PlannerSyncPlan = {
  /** Paint this snapshot on first load. Null = already on last submit. */
  applyLocal: AppState | null;
  /** First-time upload when the cloud has no submit yet. */
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

/**
 * Last cloud submit wins.
 * Opening a page paints that snapshot. No cloud row yet is not a submit.
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

  const same = syncFingerprint(localFlushed) === syncFingerprint(remoteFlushed);
  return { applyLocal: same ? null : remoteFlushed, upload: null };
}
