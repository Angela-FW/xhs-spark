import type { CalendarPost, PostMaterial, YearCalendar } from "./year-calendar";
import { buildYearCalendar } from "./year-calendar";
import {
  CALENDAR_START,
  DEFAULT_PERSONA,
  clonePersona,
  normalizePersona,
  type CreatorPersona,
  type PillarId,
} from "./persona";

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
  postsBefore: Pick<
    CalendarPost,
    "id" | "titleHint" | "angle" | "pillar" | "format"
  >[];
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
  version: 3;
  persona: CreatorPersona;
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

const STORAGE_KEY = "restart-life-planner-v3";
const LEGACY_KEYS = ["restart-life-planner-v2", "restart-life-planner-v1"];

export const DEFAULT_WEIGHTS: PillarWeights = {
  restart: 1,
  "age-edu": 1,
  resume: 1.2,
  interview: 1,
  rejection: 0.9,
  choice: 0.8,
  life: 1.1,
};

function welcomeChat(persona: CreatorPersona): ChatMessage {
  const mixHint =
    persona.contentMix === "life"
      ? "偏生活切片，穿插少量选择与关系议题"
      : persona.contentMix === "career"
        ? "偏职场成长，穿插生活节律"
        : "第一个月每周1篇建立信任；第二个月起每周2篇，并穿插生活进展";
  return {
    id: "welcome",
    role: "assistant",
    text: `你好，当前人设是「${persona.name}」。${mixHint}。可用对话微调，例如「下周多写${persona.contentMix === "life" ? "日常" : "面试"}」。`,
    createdAt: new Date().toISOString(),
  };
}

export function createInitialState(
  persona: CreatorPersona = DEFAULT_PERSONA,
): AppState {
  const p = clonePersona(persona);
  const cal = buildYearCalendar(CALENDAR_START, p);
  return {
    version: 3,
    persona: p,
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
    chat: [welcomeChat(p)],
    selectedPostId: cal.posts[0]?.id ?? null,
  };
}

/** Rebuild year plan from persona; keep insights / feedback / chat soft data. */
export function rebuildCalendarFromPersona(
  state: AppState,
  persona: CreatorPersona,
  calendarStart = state.calendarStart,
): AppState {
  const p = clonePersona(persona);
  const cal = buildYearCalendar(calendarStart || CALENDAR_START, p);
  const oldById = new Map(state.posts.map((post) => [post.id, post]));

  const posts = cal.posts.map((post) => {
    const prev = oldById.get(post.id);
    if (!prev) return post;
    return {
      ...post,
      materials: prev.materials ?? [],
      status:
        prev.status === "published" || prev.status === "drafted"
          ? prev.status
          : post.status,
    };
  });

  return {
    ...state,
    version: 3,
    persona: p,
    calendarStart: cal.startDate,
    posts,
    weekMeta: cal.weeks.map((w) => ({
      week: w.week,
      postsPerWeek: w.postsPerWeek,
    })),
    pending: null,
    selectedPostId:
      posts.find((x) => x.id === state.selectedPostId)?.id ??
      posts[0]?.id ??
      null,
  };
}

export function updatePersonaFields(
  state: AppState,
  persona: CreatorPersona,
): AppState {
  return {
    ...state,
    persona: clonePersona(persona),
  };
}

function migrateParsed(
  parsed: Omit<Partial<AppState>, "version"> & { version?: number },
): AppState {
  const fallback = createInitialState();
  const persona = normalizePersona(
    (parsed as { persona?: Partial<CreatorPersona> }).persona ??
      fallback.persona,
  );

  if (parsed.version === 3 && parsed.posts?.length) {
    return {
      ...fallback,
      ...parsed,
      version: 3,
      persona,
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
  }

  // v2 or broken: rebuild calendar with persona, keep soft data
  if (parsed.posts?.length && parsed.version === 2) {
    const soft: AppState = {
      ...fallback,
      persona,
      insights: parsed.insights ?? [],
      feedback: parsed.feedback ?? [],
      chat: parsed.chat?.length ? parsed.chat : fallback.chat,
      weights: { ...fallback.weights, ...(parsed.weights as PillarWeights) },
      snapshots: parsed.snapshots ?? [],
      pending: null,
      calendarStart: parsed.calendarStart || fallback.calendarStart,
      selectedPostId: parsed.selectedPostId ?? fallback.selectedPostId,
    };
    return rebuildCalendarFromPersona(soft, persona, soft.calendarStart);
  }

  return {
    ...fallback,
    persona,
    insights: parsed.insights ?? [],
    feedback: parsed.feedback ?? [],
    chat: parsed.chat?.length ? parsed.chat : fallback.chat,
    snapshots: [],
    pending: null,
    weights: { ...fallback.weights, ...(parsed.weights as PillarWeights) },
  };
}

export function loadState(): AppState {
  const fallback = createInitialState();
  if (typeof window === "undefined") return fallback;
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      for (const key of LEGACY_KEYS) {
        raw = localStorage.getItem(key);
        if (raw) break;
      }
    }
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<AppState> & { version?: number };
    const migrated = migrateParsed(parsed);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
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
  const parsed = JSON.parse(json) as Partial<AppState> & { version: number };
  if (!Array.isArray(parsed.posts) && parsed.version !== 3) {
    // allow persona-only? still require posts or rebuild
  }
  return migrateParsed(parsed);
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
