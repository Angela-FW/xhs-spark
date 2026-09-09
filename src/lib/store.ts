import type { CalendarPost, PostMaterial, YearCalendar } from "./year-calendar";
import { buildYearCalendar } from "./year-calendar";
import { CALENDAR_START, type PillarId } from "./persona";

export type InsightCard = {
  id: string;
  raw: string;
  summary: string;
  polished: string;
  pillar: PillarId;
  createdAt: string;
  assignedPostIds: string[];
  desensitizeNote?: string;
};

export type FeedbackEntry = {
  id: string;
  postId: string;
  createdAt: string;
  reads?: number;
  likes?: number;
  collects?: number;
  comments?: number;
  followers?: number;
  vibe: "strong" | "ok" | "flop";
  commentQuotes: string;
  wantMore: string;
  wantLess: string;
};

export type PillarWeights = Record<PillarId, number>;

export type CalibrationSnapshot = {
  id: string;
  createdAt: string;
  source: "feedback" | "dialogue";
  summary: string;
  weightsBefore: PillarWeights;
  weightsAfter: PillarWeights;
  changedPostIds: string[];
  postsBefore: Pick<CalendarPost, "id" | "titleHint" | "angle" | "pillar" | "format">[];
};

export type PendingCalibration = {
  id: string;
  source: "feedback" | "dialogue";
  summary: string;
  weightsAfter: PillarWeights;
  patch: {
    postId: string;
    titleHint?: string;
    angle?: string;
    pillar?: PillarId;
    format?: CalendarPost["format"];
  }[];
  postsPerWeekPatch?: { week: number; postsPerWeek: number }[];
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  pendingId?: string;
};

export type AppState = {
  version: 2;
  calendarStart: string;
  posts: CalendarPost[];
  weekMeta: { week: number; postsPerWeek: number }[];
  insights: InsightCard[];
  feedback: FeedbackEntry[];
  weights: PillarWeights;
  pending: PendingCalibration | null;
  snapshots: CalibrationSnapshot[];
  chat: ChatMessage[];
  selectedPostId: string | null;
};

const STORAGE_KEY = "restart-life-planner-v2";
const LEGACY_KEY = "restart-life-planner-v1";

export const DEFAULT_WEIGHTS: PillarWeights = {
  restart: 1,
  "age-edu": 1,
  resume: 1.2,
  interview: 1,
  rejection: 0.9,
  choice: 0.8,
  life: 1.1,
};

export function createInitialState(): AppState {
  const cal = buildYearCalendar(CALENDAR_START);
  return {
    version: 2,
    calendarStart: cal.startDate,
    posts: cal.posts,
    weekMeta: cal.weeks.map((w) => ({
      week: w.week,
      postsPerWeek: w.postsPerWeek,
    })),
    insights: [],
    feedback: [],
    weights: { ...DEFAULT_WEIGHTS },
    pending: null,
    snapshots: [],
    chat: [
      {
        id: "welcome",
        role: "assistant",
        text: "你好。第一个月每周1篇建立信任；第二个月起每周2篇，并穿插生活进展。可用对话调整，例如「下周多写面试」。",
        createdAt: new Date().toISOString(),
      },
    ],
    selectedPostId: cal.posts[0]?.id ?? null,
  };
}

export function loadState(): AppState {
  const fallback = createInitialState();
  if (typeof window === "undefined") return fallback;
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<AppState> & { version?: number };
    if (!parsed.posts?.length || parsed.version !== 2) {
      return {
        ...fallback,
        insights: parsed.insights ?? [],
        feedback: parsed.feedback ?? [],
        chat: parsed.chat?.length ? parsed.chat : fallback.chat,
        snapshots: [],
        pending: null,
        weights: { ...fallback.weights, ...(parsed.weights as PillarWeights) },
      };
    }
    return {
      ...fallback,
      ...parsed,
      version: 2,
      calendarStart: parsed.calendarStart || fallback.calendarStart,
      posts: parsed.posts,
      weekMeta: parsed.weekMeta?.length ? parsed.weekMeta : fallback.weekMeta,
      insights: parsed.insights ?? [],
      feedback: parsed.feedback ?? [],
      weights: { ...fallback.weights, ...(parsed.weights ?? {}) },
      pending: parsed.pending ?? null,
      snapshots: parsed.snapshots ?? [],
      chat: parsed.chat?.length ? parsed.chat : fallback.chat,
      selectedPostId: parsed.selectedPostId ?? fallback.selectedPostId,
    };
  } catch {
    return fallback;
  }
}

export function saveState(state: AppState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function exportState(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function importState(json: string): AppState {
  const parsed = JSON.parse(json) as AppState & { version: number };
  if (!Array.isArray(parsed.posts)) {
    throw new Error("备份格式不正确");
  }
  if (parsed.version !== 2) {
    const fresh = createInitialState();
    return {
      ...fresh,
      insights: parsed.insights ?? [],
      feedback: parsed.feedback ?? [],
      chat: parsed.chat?.length ? parsed.chat : fresh.chat,
    };
  }
  return { ...createInitialState(), ...parsed, version: 2 };
}

export function updatePost(
  state: AppState,
  postId: string,
  patch: Partial<CalendarPost>,
): AppState {
  return {
    ...state,
    posts: state.posts.map((p) => (p.id === postId ? { ...p, ...patch } : p)),
  };
}

export function attachMaterial(
  state: AppState,
  postId: string,
  material: PostMaterial,
  insightId?: string,
): AppState {
  let next = updatePost(state, postId, {
    materials: [
      ...(state.posts.find((p) => p.id === postId)?.materials ?? []),
      material,
    ],
  });
  if (insightId) {
    next = {
      ...next,
      insights: next.insights.map((i) =>
        i.id === insightId
          ? {
              ...i,
              assignedPostIds: Array.from(
                new Set([...i.assignedPostIds, postId]),
              ),
            }
          : i,
      ),
    };
  }
  return next;
}

export function postsByWeek(state: AppState): Map<number, CalendarPost[]> {
  const map = new Map<number, CalendarPost[]>();
  for (const p of state.posts) {
    const list = map.get(p.week) ?? [];
    list.push(p);
    map.set(p.week, list);
  }
  return map;
}

export function calendarView(state: AppState): YearCalendar {
  const byWeek = postsByWeek(state);
  const weeks = Array.from(byWeek.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([week, posts]) => ({
      week,
      weekStart: posts[0]?.weekStart ?? state.calendarStart,
      phase: posts[0]?.phase ?? 1,
      postsPerWeek:
        state.weekMeta.find((w) => w.week === week)?.postsPerWeek ??
        posts.length,
      posts: posts.sort((a, b) => a.indexInWeek - b.indexInWeek),
    }));
  return {
    startDate: state.calendarStart,
    weeks,
    posts: state.posts,
  };
}
