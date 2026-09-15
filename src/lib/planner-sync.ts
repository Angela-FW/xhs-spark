import {
  type AppState,
  plannerSubstanceScore,
  syncActiveWorkspace,
} from "@/lib/store";

export type PlannerSyncPlan = {
  /** Remote snapshot to apply locally. Null = keep the device's current notes. */
  applyRemote: AppState | null;
  /** Upload this device's notes. Never true for empty onboarding. */
  uploadLocal: boolean;
};

/**
 * Pick a winner without last-write-wins on empty state.
 * Richer notes win (drafts / published / insights beat a blank calendar).
 * Ties keep local so a phone that still has the work is not overwritten.
 */
export function resolvePlannerSync(
  local: AppState,
  remote: AppState | null,
): PlannerSyncPlan {
  const localFlushed = syncActiveWorkspace(local);
  const remoteFlushed = remote ? syncActiveWorkspace(remote) : null;
  const localScore = plannerSubstanceScore(localFlushed);
  const remoteScore = remoteFlushed ? plannerSubstanceScore(remoteFlushed) : 0;

  if (localScore > remoteScore) {
    return { applyRemote: null, uploadLocal: localScore > 0 };
  }
  if (remoteScore > localScore && remoteFlushed) {
    return { applyRemote: remoteFlushed, uploadLocal: false };
  }
  return { applyRemote: null, uploadLocal: false };
}
