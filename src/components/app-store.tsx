"use client";

import {
  createContext,
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
  setPostStatus: (postId: string, status: "planned" | "drafted" | "published") => void;
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
  const [state, setState] = useState<AppState | null>(null);

  useEffect(() => {
    setState(loadState());
  }, []);

  useEffect(() => {
    if (state) saveState(state);
  }, [state]);

  const api = useMemo<StoreApi | null>(() => {
    if (!state) return null;

    return {
      state,
      ready: true,
      setSelectedPostId: (id) => setState((s) => (s ? { ...s, selectedPostId: id } : s)),
      addInsights: (cards) =>
        setState((s) => (s ? { ...s, insights: [...cards, ...s.insights] } : s)),
      assignInsight: (insightId, postId) =>
        setState((s) => {
          if (!s) return s;
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
        }),
      setPostStatus: (postId, status) =>
        setState((s) => (s ? updatePost(s, postId, { status }) : s)),
      submitFeedback: (entry) =>
        setState((s) => {
          if (!s) return s;
          const full: FeedbackEntry = {
            ...entry,
            id: newId("fb"),
            createdAt: new Date().toISOString(),
          };
          const pending = proposeFromFeedback(
            { ...s, feedback: [full, ...s.feedback] },
            full,
          );
          return {
            ...s,
            feedback: [full, ...s.feedback],
            pending,
          };
        }),
      setPending: (pending) => setState((s) => (s ? { ...s, pending } : s)),
      confirmPending: () =>
        setState((s) => {
          if (!s?.pending) return s;
          return applyPending(s, s.pending);
        }),
      discardPending: () => setState((s) => (s ? { ...s, pending: null } : s)),
      undoCalibration: () => setState((s) => (s ? undoLastSnapshot(s) : s)),
      sendDialogue: (text) =>
        setState((s) => {
          if (!s) return s;
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
        }),
      exportJson: () => exportState(state),
      importJson: (json) => setState(importState(json)),
      resetAll: () => setState(createInitialState()),
    };
  }, [state]);

  if (!api) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-sm text-[var(--ink-soft)]">
        加载本地规划…
      </div>
    );
  }

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAppStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppStore must be used within AppStoreProvider");
  return ctx;
}
