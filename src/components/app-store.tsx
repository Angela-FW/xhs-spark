"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  type AppState,
  type FeedbackEntry,
  type InsightCard,
  type PendingCalibration,
  activateWorkspace,
  attachMaterial,
  clearPlannerStorage,
  createInitialState,
  deleteSavedPersona,
  exportState,
  hasPlannerStorage,
  importState,
  loadState,
  appendNextCalendarWeek,
  rebuildCalendarFromPersona,
  rollUnpublishedSchedule,
  savePostDraft,
  saveState,
  selectSavedPersona,
  setPostPublishStatus,
  startFromPreset,
  updatePersonaFields,
  upsertSavedPersona,
} from "@/lib/store";
import { applyPending, proposeFromFeedback, undoLastSnapshot } from "@/lib/calibrate";
import type { CreatorPersona } from "@/lib/persona";
import { MAX_SAVED_PERSONAS, type PresetId } from "@/lib/persona";

type StoreApi = {
  state: AppState;
  ready: boolean;
  setSelectedPostId: (id: string | null) => void;
  addInsights: (cards: InsightCard[]) => void;
  deleteInsight: (insightId: string) => void;
  assignInsight: (insightId: string, postId: string) => void;
  setPostStatus: (
    postId: string,
    status: "planned" | "drafted" | "published",
  ) => void;
  saveDraft: (
    postId: string,
    draft: {
      titles: string[];
      titleIndex: number;
      body: string;
      tags: string[];
      extra?: string;
    },
  ) => void;
  submitFeedback: (entry: Omit<FeedbackEntry, "id" | "createdAt">) => void;
  setPending: (pending: PendingCalibration | null) => void;
  confirmPending: () => void;
  discardPending: () => void;
  undoCalibration: () => void;
  updatePersona: (persona: CreatorPersona) => void;
  applyPersonaAndRebuild: (persona: CreatorPersona) => void;
  applySystemPreset: (id: PresetId) => void;
  startLaunchPreset: (id: PresetId) => void;
  savePersonaToList: (
    persona?: CreatorPersona,
    label?: string,
  ) => string | null;
  savePersonaToListAndRebuild: (
    persona: CreatorPersona,
    label?: string,
  ) => string | null;
  removeSavedPersona: (id: string) => void;
  pickSavedPersona: (id: string) => void;
  startBlankCustom: () => void;
  generateMoreWeek: () => void;
  exportJson: () => string;
  importJson: (json: string) => void;
  resetAll: () => void;
};

const Ctx = createContext<StoreApi | null>(null);

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  // Render immediately with seed calendar so SSR/first paint never sticks on loading.
  const [state, setState] = useState<AppState>(() => createInitialState());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setState(loadState());
    } catch (err) {
      console.error("loadState failed, keeping seed calendar", err);
    } finally {
      setHydrated(true);
    }
  }, []);

  // After Safari clears website data, a background tab can still hold old React
  // state and write it back. Reconcile when the tab is shown again.
  useEffect(() => {
    if (!hydrated) return;

    const reconcileClearedStorage = () => {
      try {
        if (hasPlannerStorage()) return;
        setState((s) =>
          s.activeWorkspaceId || s.workspaces.length > 0
            ? createInitialState()
            : s,
        );
      } catch (err) {
        console.error("reconcile storage failed", err);
      }
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        try {
          setState(loadState());
        } catch (err) {
          console.error("bfcache rehydrate failed", err);
        }
        return;
      }
      reconcileClearedStorage();
    };

    const onVis = () => {
      if (document.visibilityState === "visible") reconcileClearedStorage();
    };

    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [hydrated]);

  // Roll unpublished schedule when the local day changes (tab focus / midnight).
  useEffect(() => {
    if (!hydrated) return;
    const sync = () => {
      setState((s) => rollUnpublishedSchedule(s));
    };
    const onVis = () => {
      if (document.visibilityState === "visible") sync();
    };
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", onVis);
    const id = window.setInterval(sync, 60_000);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(id);
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      saveState(state);
    } catch (err) {
      console.error("saveState failed", err);
    }
  }, [state, hydrated]);

  const setSelectedPostId = useCallback((id: string | null) => {
    setState((s) => ({ ...s, selectedPostId: id }));
  }, []);

  const addInsights = useCallback((cards: InsightCard[]) => {
    setState((s) => ({ ...s, insights: [...cards, ...s.insights] }));
  }, []);

  const deleteInsight = useCallback((insightId: string) => {
    setState((s) => ({
      ...s,
      insights: s.insights.filter((i) => i.id !== insightId),
    }));
  }, []);

  const assignInsight = useCallback((insightId: string, postId: string) => {
    setState((s) => {
      const insight = s.insights.find((i) => i.id === insightId);
      if (!insight) return s;
      return attachMaterial(
        s,
        postId,
        {
          id: newId("mat"),
          summary: insight.summary,
          polished: insight.polished,
          sourceInsightId: insight.id,
        },
        insightId,
      );
    });
  }, []);

  const setPostStatus = useCallback(
    (postId: string, status: "planned" | "drafted" | "published") => {
      setState((s) => setPostPublishStatus(s, postId, status));
    },
    [],
  );

  const saveDraft = useCallback(
    (
      postId: string,
      draft: {
        titles: string[];
        titleIndex: number;
        body: string;
        tags: string[];
        extra?: string;
      },
    ) => {
      setState((s) => savePostDraft(s, postId, draft));
    },
    [],
  );

  const submitFeedback = useCallback(
    (entry: Omit<FeedbackEntry, "id" | "createdAt">) => {
      setState((s) => {
        const full: FeedbackEntry = {
          ...entry,
          id: newId("fb"),
          createdAt: new Date().toISOString(),
        };
        const withFb = { ...s, feedback: [full, ...s.feedback] };
        const pending = proposeFromFeedback(withFb, full);
        return { ...withFb, pending };
      });
    },
    [],
  );

  const setPending = useCallback((pending: PendingCalibration | null) => {
    setState((s) => ({ ...s, pending }));
  }, []);

  const confirmPending = useCallback(() => {
    setState((s) => (s.pending ? applyPending(s, s.pending) : s));
  }, []);

  const discardPending = useCallback(() => {
    setState((s) => ({ ...s, pending: null }));
  }, []);

  const undoCalibration = useCallback(() => {
    setState((s) => undoLastSnapshot(s));
  }, []);

  const updatePersona = useCallback((persona: CreatorPersona) => {
    setState((s) => updatePersonaFields(s, persona));
  }, []);

  const applyPersonaAndRebuild = useCallback((persona: CreatorPersona) => {
    setState((s) => rebuildCalendarFromPersona(s, persona));
  }, []);

  const applySystemPreset = useCallback((id: PresetId) => {
    setState((s) => {
      const existing = s.workspaces.find((w) => w.persona.presetId === id);
      if (existing) return activateWorkspace(s, existing.id);
      return startFromPreset(s, id);
    });
  }, []);

  const startLaunchPreset = useCallback((id: PresetId) => {
    setState((s) => {
      if (s.workspaces.length >= MAX_SAVED_PERSONAS) {
        alert(`人设最多 ${MAX_SAVED_PERSONAS} 个，请先删除一个再新建`);
        return s;
      }
      return startFromPreset(s, id);
    });
  }, []);

  const savePersonaToList = useCallback(
    (persona?: CreatorPersona, label?: string) => {
      let savedId: string | null = null;
      setState((s) => {
        const result = upsertSavedPersona(s, persona ?? s.persona, {
          id: s.activeWorkspaceId,
          label: label || persona?.name,
        });
        if (result.error) {
          alert(result.error);
          return s;
        }
        savedId = result.id ?? null;
        return result.state;
      });
      return savedId;
    },
    [],
  );

  const savePersonaToListAndRebuild = useCallback(
    (persona: CreatorPersona, label?: string) => {
      let savedId: string | null = null;
      setState((s) => {
        const result = upsertSavedPersona(s, persona, {
          id: s.activeWorkspaceId,
          label: label || persona.name,
        });
        if (result.error) {
          alert(result.error);
          return s;
        }
        savedId = result.id ?? null;
        return rebuildCalendarFromPersona(result.state, result.state.persona);
      });
      return savedId;
    },
    [],
  );

  const removeSavedPersona = useCallback((id: string) => {
    setState((s) => deleteSavedPersona(s, id));
  }, []);

  const pickSavedPersona = useCallback((id: string) => {
    setState((s) => selectSavedPersona(s, id));
  }, []);

  const startBlankCustom = useCallback(() => {
    setState((s) => startFromPreset(s, "custom"));
  }, []);

  const generateMoreWeek = useCallback(() => {
    setState((s) => appendNextCalendarWeek(s));
  }, []);

  const exportJson = useCallback(() => exportState(state), [state]);

  const importJson = useCallback((json: string) => {
    setState(importState(json));
  }, []);

  const resetAll = useCallback(() => {
    clearPlannerStorage();
    setState(createInitialState());
  }, []);

  const api = useMemo<StoreApi>(
    () => ({
      state,
      ready: hydrated,
      setSelectedPostId,
      addInsights,
      deleteInsight,
      assignInsight,
      setPostStatus,
      saveDraft,
      submitFeedback,
      setPending,
      confirmPending,
      discardPending,
      undoCalibration,
      updatePersona,
      applyPersonaAndRebuild,
      applySystemPreset,
      startLaunchPreset,
      savePersonaToList,
      savePersonaToListAndRebuild,
      removeSavedPersona,
      pickSavedPersona,
      startBlankCustom,
      generateMoreWeek,
      exportJson,
      importJson,
      resetAll,
    }),
    [
      state,
      hydrated,
      setSelectedPostId,
      addInsights,
      deleteInsight,
      assignInsight,
      setPostStatus,
      saveDraft,
      submitFeedback,
      setPending,
      confirmPending,
      discardPending,
      undoCalibration,
      updatePersona,
      applyPersonaAndRebuild,
      applySystemPreset,
      startLaunchPreset,
      savePersonaToList,
      savePersonaToListAndRebuild,
      removeSavedPersona,
      pickSavedPersona,
      startBlankCustom,
      generateMoreWeek,
      exportJson,
      importJson,
      resetAll,
    ],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAppStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppStore must be used within AppStoreProvider");
  return ctx;
}
