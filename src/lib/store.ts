import type { CalendarPost, PostMaterial, YearCalendar } from "./year-calendar";
import {
  addDays,
  buildWeekPosts,
  buildYearCalendar,
  diffCalendarDays,
  mondayOnOrAfter,
  todayLocal,
} from "./year-calendar";
import {
  DEFAULT_PERSONA,
  MAX_SAVED_PERSONAS,
  clonePersona,
  defaultCalendarStart,
  ensurePersonaTopicSeeds,
  normalizePersona,
  type CreatorPersona,
  type PillarId,
  type SavedPersonaSlot,
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
  /** User-saved custom personas, max MAX_SAVED_PERSONAS. */
  savedPersonas: SavedPersonaSlot[];
  /** Currently selected saved slot id, if any. */
  activeSavedPersonaId: string | null;
  calendarStart: string;
  /** Last local day the unpublished schedule was rolled to. */
  scheduleAsOf: string;
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
    text: `你好，当前人设是「${persona.name}」。${mixHint}。`,
    createdAt: new Date().toISOString(),
  };
}

export function createInitialState(
  persona: CreatorPersona = DEFAULT_PERSONA,
): AppState {
  const p = clonePersona(persona);
  const today = todayLocal();
  const cal = buildYearCalendar(defaultCalendarStart(), p, 1);
  return {
    version: 3,
    persona: p,
    savedPersonas: [],
    activeSavedPersonaId: null,
    calendarStart: cal.startDate,
    scheduleAsOf: today,
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

/**
 * Unpublished (待写/已起草) notes shift forward 1 day per elapsed day.
 * Published notes keep their weekStart and publishedAt.
 * Also catch up if unpublished dates still sit before today (legacy data).
 */
export function rollUnpublishedSchedule(
  state: AppState,
  today = todayLocal(),
): AppState {
  const asOf = state.scheduleAsOf || today;
  let days = Math.max(0, diffCalendarDays(asOf, today));

  let posts = state.posts;
  if (days > 0) {
    posts = posts.map((p) =>
      p.status === "published"
        ? p
        : { ...p, weekStart: addDays(p.weekStart, days) },
    );
  }

  const unpublished = posts.filter((p) => p.status !== "published");
  if (unpublished.length) {
    const earliest = unpublished.reduce(
      (min, p) => (p.weekStart < min ? p.weekStart : min),
      unpublished[0].weekStart,
    );
    const lag = diffCalendarDays(earliest, today);
    if (lag > 0) {
      posts = posts.map((p) =>
        p.status === "published"
          ? p
          : { ...p, weekStart: addDays(p.weekStart, lag) },
      );
      days += lag;
    }
  }

  if (days <= 0 && state.scheduleAsOf === today) return state;

  const stillOpen = posts.filter((p) => p.status !== "published");
  const calendarStart = stillOpen.length
    ? stillOpen.reduce(
        (min, p) => (p.weekStart < min ? p.weekStart : min),
        stillOpen[0].weekStart,
      )
    : state.calendarStart;

  return {
    ...state,
    calendarStart,
    scheduleAsOf: today,
    posts,
  };
}

/**
 * Full-year rebuild (migration / recovery). Published + drafted keep status,
 * materials, and locked schedule; planned topics are fully refreshed.
 */
export function rebuildFullCalendarFromPersona(
  state: AppState,
  persona: CreatorPersona,
  calendarStart?: string,
): AppState {
  const p = ensurePersonaTopicSeeds(persona);
  const today = todayLocal();
  const start =
    calendarStart || state.calendarStart || defaultCalendarStart();
  const cal = buildYearCalendar(start, p);
  const oldById = new Map(state.posts.map((post) => [post.id, post]));

  const posts = cal.posts.map((post) => {
    const prev = oldById.get(post.id);
    if (!prev) return post;
    const status =
      prev.status === "published" || prev.status === "drafted"
        ? prev.status
        : post.status;
    return {
      ...post,
      materials: prev.materials ?? [],
      status,
      publishedAt:
        status === "published" ? prev.publishedAt || today : undefined,
      weekStart:
        status === "published" && prev.weekStart
          ? prev.weekStart
          : post.weekStart,
      titleHint:
        status === "published" || status === "drafted"
          ? prev.titleHint
          : post.titleHint,
      angle:
        status === "published" || status === "drafted"
          ? prev.angle
          : post.angle,
      hooks:
        status === "published" || status === "drafted"
          ? prev.hooks
          : post.hooks,
      trustAnchor:
        status === "published" || status === "drafted"
          ? prev.trustAnchor
          : post.trustAnchor,
      format:
        status === "published" || status === "drafted"
          ? prev.format
          : post.format,
      pillar:
        status === "published" || status === "drafted"
          ? prev.pillar
          : post.pillar,
      draft:
        status === "published" || status === "drafted"
          ? prev.draft
          : post.draft,
    };
  });

  return {
    ...state,
    version: 3,
    persona: p,
    calendarStart: cal.startDate,
    scheduleAsOf: today,
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

/**
 * Rebuild from persona: drop other *planned* weeks; keep published + drafted.
 * Generate only the next future week of planned posts.
 */
export function rebuildCalendarFromPersona(
  state: AppState,
  persona: CreatorPersona,
  calendarStart?: string,
): AppState {
  const p = ensurePersonaTopicSeeds(persona);
  const today = todayLocal();
  const locked = state.posts.filter(
    (post) => post.status === "published" || post.status === "drafted",
  );
  const usedTitles = new Set(locked.map((post) => post.titleHint));

  const maxWeek = locked.reduce((max, post) => Math.max(max, post.week), 0);
  const nextWeek = maxWeek + 1;

  const todayMonday = mondayOnOrAfter(today);
  let nextWeekStart = todayMonday;
  if (locked.length) {
    const latestWeekStart = locked
      .filter((post) => post.week === maxWeek)
      .reduce(
        (max, post) => (post.weekStart > max ? post.weekStart : max),
        locked.find((post) => post.week === maxWeek)?.weekStart ||
          locked[0].weekStart,
      );
    const afterLatest = addDays(latestWeekStart, 7);
    nextWeekStart = afterLatest >= todayMonday ? afterLatest : todayMonday;
  } else if (calendarStart || state.calendarStart) {
    nextWeekStart = mondayOnOrAfter(
      calendarStart || state.calendarStart || today,
    );
  }

  const built = buildWeekPosts({
    week: nextWeek,
    weekStart: nextWeekStart,
    persona: p,
    usedTitles,
  });

  const posts = [...locked, ...built.posts].sort(
    (a, b) => a.week - b.week || a.indexInWeek - b.indexInWeek,
  );

  const weekMetaByWeek = new Map<number, { week: number; postsPerWeek: number }>();
  for (const post of locked) {
    const existing = weekMetaByWeek.get(post.week);
    const count = locked.filter((x) => x.week === post.week).length;
    if (!existing) {
      weekMetaByWeek.set(post.week, {
        week: post.week,
        postsPerWeek:
          state.weekMeta.find((w) => w.week === post.week)?.postsPerWeek ??
          count,
      });
    }
  }
  weekMetaByWeek.set(nextWeek, {
    week: nextWeek,
    postsPerWeek: built.week.postsPerWeek,
  });

  return {
    ...state,
    version: 3,
    persona: p,
    calendarStart:
      state.calendarStart || calendarStart || nextWeekStart,
    scheduleAsOf: today,
    posts,
    weekMeta: Array.from(weekMetaByWeek.values()).sort(
      (a, b) => a.week - b.week,
    ),
    pending: null,
    selectedPostId:
      posts.find((x) => x.id === state.selectedPostId)?.id ??
      built.posts[0]?.id ??
      posts[0]?.id ??
      null,
  };
}

/** Append one more future week of planned posts after the current frontier. */
export function appendNextCalendarWeek(state: AppState): AppState {
  const p = ensurePersonaTopicSeeds(state.persona);
  const maxWeek = state.posts.reduce(
    (max, post) => Math.max(max, post.week),
    0,
  );
  const nextWeek = maxWeek + 1;
  const todayMonday = mondayOnOrAfter(todayLocal());

  let nextWeekStart = todayMonday;
  if (state.posts.length) {
    const frontier = state.posts.filter((post) => post.week === maxWeek);
    const frontierStart = frontier.reduce(
      (max, post) => (post.weekStart > max ? post.weekStart : max),
      frontier[0]?.weekStart || state.calendarStart,
    );
    const after = addDays(frontierStart, 7);
    nextWeekStart = after >= todayMonday ? after : todayMonday;
  }

  const usedTitles = new Set(state.posts.map((post) => post.titleHint));
  const built = buildWeekPosts({
    week: nextWeek,
    weekStart: nextWeekStart,
    persona: p,
    usedTitles,
  });

  const posts = [...state.posts, ...built.posts].sort(
    (a, b) => a.week - b.week || a.indexInWeek - b.indexInWeek,
  );

  const weekMeta = [
    ...state.weekMeta.filter((w) => w.week !== nextWeek),
    { week: nextWeek, postsPerWeek: built.week.postsPerWeek },
  ].sort((a, b) => a.week - b.week);

  return {
    ...state,
    posts,
    weekMeta,
    selectedPostId: state.selectedPostId ?? built.posts[0]?.id ?? null,
  };
}

export function updatePersonaFields(
  state: AppState,
  persona: CreatorPersona,
): AppState {
  return {
    ...state,
    persona: ensurePersonaTopicSeeds(persona),
  };
}

function newSavedId() {
  return `saved-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Save / update current persona into the custom list (max 10). */
export function upsertSavedPersona(
  state: AppState,
  persona: CreatorPersona,
  opts?: { id?: string | null; label?: string },
): { state: AppState; error?: string; id?: string } {
  const ready = ensurePersonaTopicSeeds({
    ...clonePersona(persona),
    presetId: "custom",
  });
  const label = (opts?.label || ready.name || "未命名人设").trim();
  const list = [...state.savedPersonas];
  const existingId = opts?.id ?? state.activeSavedPersonaId;
  const idx = existingId ? list.findIndex((s) => s.id === existingId) : -1;

  if (idx >= 0) {
    list[idx] = {
      ...list[idx],
      label,
      persona: ready,
      updatedAt: new Date().toISOString(),
    };
    return {
      state: {
        ...state,
        persona: ready,
        savedPersonas: list,
        activeSavedPersonaId: list[idx].id,
      },
      id: list[idx].id,
    };
  }

  if (list.length >= MAX_SAVED_PERSONAS) {
    return {
      state,
      error: `自定义人设最多 ${MAX_SAVED_PERSONAS} 个，请先删除一个再保存`,
    };
  }

  const id = newSavedId();
  list.push({
    id,
    label,
    persona: ready,
    updatedAt: new Date().toISOString(),
  });
  return {
    state: {
      ...state,
      persona: ready,
      savedPersonas: list,
      activeSavedPersonaId: id,
    },
    id,
  };
}

export function deleteSavedPersona(
  state: AppState,
  id: string,
): AppState {
  const savedPersonas = state.savedPersonas.filter((s) => s.id !== id);
  return {
    ...state,
    savedPersonas,
    activeSavedPersonaId:
      state.activeSavedPersonaId === id ? null : state.activeSavedPersonaId,
  };
}

export function selectSavedPersona(
  state: AppState,
  id: string,
): AppState {
  const slot = state.savedPersonas.find((s) => s.id === id);
  if (!slot) return state;
  return rebuildCalendarFromPersona(
    { ...state, activeSavedPersonaId: id },
    slot.persona,
  );
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
    const savedRaw = Array.isArray(
      (parsed as { savedPersonas?: SavedPersonaSlot[] }).savedPersonas,
    )
      ? (parsed as { savedPersonas: SavedPersonaSlot[] }).savedPersonas
      : [];
    const savedPersonas = savedRaw
      .slice(0, MAX_SAVED_PERSONAS)
      .map((s) => ({
        id: String(s.id || newSavedId()),
        label: String(s.label || s.persona?.name || "未命名人设"),
        persona: ensurePersonaTopicSeeds(normalizePersona(s.persona)),
        updatedAt: String(s.updatedAt || new Date().toISOString()),
      }));
    return {
      ...fallback,
      ...parsed,
      version: 3,
      persona: ensurePersonaTopicSeeds(persona),
      savedPersonas,
      activeSavedPersonaId:
        (parsed as { activeSavedPersonaId?: string | null })
          .activeSavedPersonaId ?? null,
      calendarStart: parsed.calendarStart || fallback.calendarStart,
      scheduleAsOf:
        (parsed as { scheduleAsOf?: string }).scheduleAsOf ||
        parsed.calendarStart ||
        fallback.scheduleAsOf,
      posts: parsed.posts.map((p) => ({
        ...p,
        publishedAt:
          p.status === "published"
            ? p.publishedAt || undefined
            : undefined,
      })),
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
    return rebuildFullCalendarFromPersona(soft, persona, soft.calendarStart);
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
    const migrated = rollUnpublishedSchedule(migrateParsed(parsed));
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

export function setPostPublishStatus(
  state: AppState,
  postId: string,
  status: CalendarPost["status"],
  today = todayLocal(),
): AppState {
  if (status === "published") {
    return updatePost(state, postId, {
      status,
      publishedAt: today,
      weekStart: today,
    });
  }
  return updatePost(state, postId, {
    status,
    publishedAt: undefined,
  });
}

/** Persist generate draft; bump planned → drafted; sync titleHint from chosen title. */
export function savePostDraft(
  state: AppState,
  postId: string,
  draft: {
    titles: string[];
    titleIndex: number;
    body: string;
    tags: string[];
    extra?: string;
  },
): AppState {
  const post = state.posts.find((p) => p.id === postId);
  if (!post) return state;
  const title =
    draft.titles[draft.titleIndex]?.trim() ||
    draft.titles[0]?.trim() ||
    post.titleHint;
  const nextStatus =
    post.status === "published" ? "published" : ("drafted" as const);
  return updatePost(state, postId, {
    titleHint: title || post.titleHint,
    status: nextStatus,
    publishedAt: nextStatus === "published" ? post.publishedAt : undefined,
    draft: {
      titles: draft.titles,
      titleIndex: draft.titleIndex,
      body: draft.body,
      tags: draft.tags,
      extra: draft.extra?.trim() || undefined,
    },
  });
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
