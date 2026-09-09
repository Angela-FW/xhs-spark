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
  attachMaterial,
  createInitialState,
  exportState,
  importState,
  loadState,
  saveState,
  updatePost,
} from "@/lib/store";
import { applyPending, proposeFromFeedback, undoLastSnapshot } from "@/lib/calibrate";
import { parseDialogue } from "@/lib/dialogue";

type StoreApi = {
  state: AppState;
  ready: boolean;
  setSelectedPostId: (id: string | null) => void;
  addInsights: (cards: InsightCard[]) => void;
  assignInsight: (insightId: string, postId: string) => void;
  setPostStatus: (
    postId: string,
    status: "planned" | "drafted" | "published",
  ) => void;
  submitFeedback: (entry: Omit<FeedbackEntry, "id" | "createdAt">) => void;
  setPending: (pending: PendingCalibration | null) => void;
  confirmPending: () => void;
  discardPending: () => void;
  undoCalibration: () => void;
  sendDialogue: (text: string) => void;
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
      setState((s) => updatePost(s, postId, { status }));
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

  const sendDialogue = useCallback((text: string) => {
    setState((s) => {
      const userMsg = {
        id: newId("msg"),
        role: "user" as const,
        text,
        createdAt: new Date().toISOString(),
      };
      const future = s.posts
        .filter((p) => p.status === "planned")
        .sort((a, b) => a.week - b.week);
      const parsed = parseDialogue(text, s.weights, future);
      const assistant = {
        id: newId("msg"),
        role: "assistant" as const,
        text: parsed.reply,
        createdAt: new Date().toISOString(),
        pendingId: parsed.ok ? parsed.pending.id : undefined,
      };
      return {
        ...s,
        chat: [...s.chat, userMsg, assistant],
        pending: parsed.ok ? parsed.pending : s.pending,
      };
    });
  }, []);

  const exportJson = useCallback(() => exportState(state), [state]);

  const importJson = useCallback((json: string) => {
    setState(importState(json));
  }, []);

  const resetAll = useCallback(() => {
    setState(createInitialState());
  }, []);

  const api = useMemo<StoreApi>(
    () => ({
      state,
      ready: hydrated,
      setSelectedPostId,
      addInsights,
      assignInsight,
      setPostStatus,
      submitFeedback,
      setPending,
      confirmPending,
      discardPending,
      undoCalibration,
      sendDialogue,
      exportJson,
      importJson,
      resetAll,
    }),
    [
      state,
      hydrated,
      setSelectedPostId,
      addInsights,
      assignInsight,
      setPostStatus,
      submitFeedback,
      setPending,
      confirmPending,
      discardPending,
      undoCalibration,
      sendDialogue,
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
