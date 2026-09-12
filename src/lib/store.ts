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
  PERSONA_PRESETS,
  clonePersona,
  defaultCalendarStart,
  ensurePersonaTopicSeeds,
  getPreset,
  normalizePersona,
  type CreatorPersona,
  type PillarId,
  type PresetId,
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

/** One persona + its isolated notes / calendar / soft data. */
export type PersonaWorkspace = {
  id: string;
  label: string;
  persona: CreatorPersona;
  updatedAt: string;
  calendarStart: string;
  scheduleAsOf: string;
  posts: CalendarPost[];
  weekMeta: { week: number; postsPerWeek: number }[];
  insights: InsightCard[];
  selectedPostId: string | null;
  feedback: FeedbackEntry[];
  weights: PillarWeights;
  pending: PendingCalibration | null;
  snapshots: CalibrationSnapshot[];
  chat: ChatMessage[];
};

export type AppState = {
  version: 4;
  /** null → show launch-direction onboarding */
  activeWorkspaceId: string | null;
  workspaces: PersonaWorkspace[];
  /** Active workspace mirror (kept for existing UI). */
  persona: CreatorPersona;
  calendarStart: string;
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

/** How many weeks to generate when starting / resetting a persona path. */
export const INITIAL_PLAN_WEEKS = 4;

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
      ? "先破冰认识你，再给可带走的具体方法"
      : persona.contentMix === "career"
        ? "用真实职场日常建立信任，再谈方法"
        : "第一个月慢热建立信任，再穿插干货与生活";
  return {
    id: "welcome",
    role: "assistant",
    text: `你好，当前人设是「${persona.name}」。${mixHint}。未来 ${INITIAL_PLAN_WEEKS} 周路线已排好，可往后翻继续生成。`,
    createdAt: new Date().toISOString(),
  };
}

function newWorkspaceId() {
  return `ws-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyActiveMirror(persona: CreatorPersona = DEFAULT_PERSONA): Omit<
  AppState,
  "version" | "activeWorkspaceId" | "workspaces"
> {
  const p = ensurePersonaTopicSeeds(clonePersona(persona));
  const today = todayLocal();
  return {
    persona: p,
    calendarStart: defaultCalendarStart(),
    scheduleAsOf: today,
    posts: [],
    weekMeta: [],
    insights: [],
    feedback: [],
    weights: { ...DEFAULT_WEIGHTS },
    pending: null,
    snapshots: [],
    chat: [],
    selectedPostId: null,
  };
}

function workspaceFromMirror(
  state: AppState,
  id: string,
  label?: string,
): PersonaWorkspace {
  return {
    id,
    label: (label || state.persona.name || "未命名人设").trim(),
    persona: clonePersona(state.persona),
    updatedAt: new Date().toISOString(),
    calendarStart: state.calendarStart,
    scheduleAsOf: state.scheduleAsOf,
    posts: state.posts,
    weekMeta: state.weekMeta,
    insights: state.insights,
    selectedPostId: state.selectedPostId,
    feedback: state.feedback,
    weights: { ...state.weights },
    pending: state.pending,
    snapshots: state.snapshots,
    chat: state.chat,
  };
}

function mirrorFromWorkspace(ws: PersonaWorkspace): Omit<
  AppState,
  "version" | "activeWorkspaceId" | "workspaces"
> {
  return {
    persona: ensurePersonaTopicSeeds(clonePersona(ws.persona)),
    calendarStart: ws.calendarStart,
    scheduleAsOf: ws.scheduleAsOf,
    posts: ws.posts,
    weekMeta: ws.weekMeta,
    insights: ws.insights,
    feedback: ws.feedback,
    weights: { ...ws.weights },
    pending: ws.pending,
    snapshots: ws.snapshots,
    chat: ws.chat,
    selectedPostId: ws.selectedPostId,
  };
}

/** Persist active mirror into workspaces[]. */
export function syncActiveWorkspace(state: AppState): AppState {
  if (!state.activeWorkspaceId) return state;
  const idx = state.workspaces.findIndex((w) => w.id === state.activeWorkspaceId);
  if (idx < 0) return state;
  const workspaces = [...state.workspaces];
  workspaces[idx] = workspaceFromMirror(state, state.activeWorkspaceId, workspaces[idx].label);
  return { ...state, workspaces };
}

export function createInitialState(): AppState {
  return {
    version: 4,
    activeWorkspaceId: null,
    workspaces: [],
    ...emptyActiveMirror(),
  };
}

/** Start a new persona workspace from a launch preset (keeps other workspaces). */
export function startFromPreset(state: AppState, presetId: PresetId): AppState {
  const flushed = syncActiveWorkspace(state);
  if (flushed.workspaces.length >= MAX_SAVED_PERSONAS) {
    return flushed;
  }
  const persona = ensurePersonaTopicSeeds(getPreset(presetId));
  const today = todayLocal();
  const cal = buildYearCalendar(defaultCalendarStart(), persona, INITIAL_PLAN_WEEKS);
  const id = newWorkspaceId();
  const label =
    PERSONA_PRESETS.find((p) => p.id === presetId)?.label || persona.name;
  const ws: PersonaWorkspace = {
    id,
    label,
    persona,
    updatedAt: new Date().toISOString(),
    calendarStart: cal.startDate,
    scheduleAsOf: today,
    posts: cal.posts,
    weekMeta: cal.weeks.map((w) => ({
      week: w.week,
      postsPerWeek: w.postsPerWeek,
    })),
    insights: [],
    selectedPostId: cal.posts[0]?.id ?? null,
    feedback: [],
    weights: { ...DEFAULT_WEIGHTS },
    pending: null,
    snapshots: [],
    chat: [welcomeChat(persona)],
  };
  return {
    ...flushed,
    version: 4,
    activeWorkspaceId: id,
    workspaces: [...flushed.workspaces, ws],
    ...mirrorFromWorkspace(ws),
  };
}

export function activateWorkspace(state: AppState, id: string): AppState {
  const flushed = syncActiveWorkspace(state);
  const ws = flushed.workspaces.find((w) => w.id === id);
  if (!ws) return flushed;
  return {
    ...flushed,
    activeWorkspaceId: id,
    ...mirrorFromWorkspace(ws),
  };
}

export function deleteWorkspace(state: AppState, id: string): AppState {
  const flushed = syncActiveWorkspace(state);
  const workspaces = flushed.workspaces.filter((w) => w.id !== id);
  if (flushed.activeWorkspaceId !== id) {
    return { ...flushed, workspaces };
  }
  const next = workspaces[0];
  if (!next) {
    return {
      ...createInitialState(),
    };
  }
  return {
    ...flushed,
    workspaces,
    activeWorkspaceId: next.id,
    ...mirrorFromWorkspace(next),
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
    version: 4,
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
 * If nothing locked, seed the first INITIAL_PLAN_WEEKS weeks.
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

  if (!locked.length) {
    const start = mondayOnOrAfter(
      calendarStart || state.calendarStart || defaultCalendarStart(),
    );
    const cal = buildYearCalendar(start, p, INITIAL_PLAN_WEEKS);
    return {
      ...state,
      version: 4,
      persona: p,
      calendarStart: cal.startDate,
      scheduleAsOf: today,
      posts: cal.posts,
      weekMeta: cal.weeks.map((w) => ({
        week: w.week,
        postsPerWeek: w.postsPerWeek,
      })),
      pending: null,
      selectedPostId: cal.posts[0]?.id ?? null,
      chat: state.chat.length ? state.chat : [welcomeChat(p)],
    };
  }

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
    version: 4,
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

/** Save / update current persona into the active workspace (or create one). */
export function upsertSavedPersona(
  state: AppState,
  persona: CreatorPersona,
  opts?: { id?: string | null; label?: string },
): { state: AppState; error?: string; id?: string } {
  const ready = ensurePersonaTopicSeeds({
    ...clonePersona(persona),
    presetId: persona.presetId === "custom" ? "custom" : persona.presetId,
  });
  const label = (opts?.label || ready.name || "未命名人设").trim();
  const flushed = syncActiveWorkspace(state);
  const existingId = opts?.id ?? flushed.activeWorkspaceId;

  if (existingId) {
    const idx = flushed.workspaces.findIndex((w) => w.id === existingId);
    if (idx >= 0) {
      const withPersona = {
        ...flushed,
        activeWorkspaceId: existingId,
        persona: ready,
      };
      const workspaces = [...flushed.workspaces];
      workspaces[idx] = {
        ...workspaceFromMirror(withPersona, existingId, label),
        label,
      };
      return {
        state: {
          ...withPersona,
          workspaces,
        },
        id: existingId,
      };
    }
  }

  if (flushed.workspaces.length >= MAX_SAVED_PERSONAS) {
    return {
      state: flushed,
      error: `人设最多 ${MAX_SAVED_PERSONAS} 个，请先删除一个再保存`,
    };
  }

  const id = newWorkspaceId();
  const seeded = rebuildCalendarFromPersona(
    {
      ...flushed,
      activeWorkspaceId: id,
      persona: ready,
      posts: [],
      weekMeta: [],
      insights: [],
      selectedPostId: null,
      chat: [welcomeChat(ready)],
    },
    ready,
  );
  const ws = workspaceFromMirror(seeded, id, label);
  return {
    state: {
      ...seeded,
      activeWorkspaceId: id,
      workspaces: [...flushed.workspaces, ws],
    },
    id,
  };
}

export function deleteSavedPersona(state: AppState, id: string): AppState {
  return deleteWorkspace(state, id);
}

export function selectSavedPersona(state: AppState, id: string): AppState {
  return activateWorkspace(state, id);
}

function migrateParsed(
  parsed: Omit<Partial<AppState>, "version"> & { version?: number } & {
    savedPersonas?: SavedPersonaSlot[];
    activeSavedPersonaId?: string | null;
  },
): AppState {
  const fallback = createInitialState();

  if (parsed.version === 4 && Array.isArray(parsed.workspaces)) {
    const workspaces = parsed.workspaces
      .slice(0, MAX_SAVED_PERSONAS)
      .map((w) => ({
        ...w,
        id: String(w.id || newWorkspaceId()),
        label: String(w.label || w.persona?.name || "未命名人设"),
        persona: ensurePersonaTopicSeeds(normalizePersona(w.persona)),
        posts: Array.isArray(w.posts) ? w.posts : [],
        weekMeta: Array.isArray(w.weekMeta) ? w.weekMeta : [],
        insights: Array.isArray(w.insights) ? w.insights : [],
        feedback: Array.isArray(w.feedback) ? w.feedback : [],
        weights: { ...DEFAULT_WEIGHTS, ...(w.weights ?? {}) },
        pending: w.pending ?? null,
        snapshots: Array.isArray(w.snapshots) ? w.snapshots : [],
        chat: Array.isArray(w.chat) ? w.chat : [],
        selectedPostId: w.selectedPostId ?? null,
        calendarStart: w.calendarStart || defaultCalendarStart(),
        scheduleAsOf: w.scheduleAsOf || todayLocal(),
        updatedAt: w.updatedAt || new Date().toISOString(),
      }));
    const activeId =
      parsed.activeWorkspaceId &&
      workspaces.some((w) => w.id === parsed.activeWorkspaceId)
        ? parsed.activeWorkspaceId
        : workspaces[0]?.id ?? null;
    if (!activeId) return fallback;
    const active = workspaces.find((w) => w.id === activeId)!;
    return {
      version: 4,
      activeWorkspaceId: activeId,
      workspaces,
      ...mirrorFromWorkspace(active),
    };
  }

  const persona = ensurePersonaTopicSeeds(
    normalizePersona(
      (parsed as { persona?: Partial<CreatorPersona> }).persona ??
        fallback.persona,
    ),
  );

  if (parsed.version === 3 && parsed.posts?.length) {
    const primaryId = newWorkspaceId();
    const primary: PersonaWorkspace = {
      id: primaryId,
      label: persona.name || "当前人设",
      persona,
      updatedAt: new Date().toISOString(),
      calendarStart: parsed.calendarStart || defaultCalendarStart(),
      scheduleAsOf:
        parsed.scheduleAsOf || parsed.calendarStart || todayLocal(),
      posts: parsed.posts.map((p) => ({
        ...p,
        publishedAt:
          p.status === "published" ? p.publishedAt || undefined : undefined,
      })),
      weekMeta: parsed.weekMeta?.length ? parsed.weekMeta : [],
      insights: parsed.insights ?? [],
      selectedPostId: parsed.selectedPostId ?? parsed.posts[0]?.id ?? null,
      feedback: parsed.feedback ?? [],
      weights: { ...DEFAULT_WEIGHTS, ...(parsed.weights ?? {}) },
      pending: parsed.pending ?? null,
      snapshots: parsed.snapshots ?? [],
      chat: parsed.chat?.length ? parsed.chat : [welcomeChat(persona)],
    };

    const extras: PersonaWorkspace[] = (parsed.savedPersonas || [])
      .filter((s) => s.id !== parsed.activeSavedPersonaId)
      .slice(0, MAX_SAVED_PERSONAS - 1)
      .map((s) => {
        const p = ensurePersonaTopicSeeds(normalizePersona(s.persona));
        const cal = buildYearCalendar(
          defaultCalendarStart(),
          p,
          INITIAL_PLAN_WEEKS,
        );
        return {
          id: String(s.id || newWorkspaceId()),
          label: String(s.label || p.name || "未命名人设"),
          persona: p,
          updatedAt: String(s.updatedAt || new Date().toISOString()),
          calendarStart: cal.startDate,
          scheduleAsOf: todayLocal(),
          posts: cal.posts,
          weekMeta: cal.weeks.map((w) => ({
            week: w.week,
            postsPerWeek: w.postsPerWeek,
          })),
          insights: [],
          selectedPostId: cal.posts[0]?.id ?? null,
          feedback: [],
          weights: { ...DEFAULT_WEIGHTS },
          pending: null,
          snapshots: [],
          chat: [welcomeChat(p)],
        };
      });

    const workspaces = [primary, ...extras].slice(0, MAX_SAVED_PERSONAS);
    return {
      version: 4,
      activeWorkspaceId: primaryId,
      workspaces,
      ...mirrorFromWorkspace(primary),
    };
  }

  if (parsed.posts?.length && parsed.version === 2) {
    const soft: AppState = {
      ...fallback,
      persona,
      insights: parsed.insights ?? [],
      feedback: parsed.feedback ?? [],
      chat: parsed.chat?.length ? parsed.chat : [welcomeChat(persona)],
      weights: { ...fallback.weights, ...(parsed.weights as PillarWeights) },
      snapshots: parsed.snapshots ?? [],
      pending: null,
      calendarStart: parsed.calendarStart || fallback.calendarStart,
      selectedPostId: parsed.selectedPostId ?? fallback.selectedPostId,
    };
    const rebuilt = rebuildFullCalendarFromPersona(
      soft,
      persona,
      soft.calendarStart,
    );
    const id = newWorkspaceId();
    const ws = workspaceFromMirror(rebuilt, id, persona.name);
    return {
      ...rebuilt,
      version: 4,
      activeWorkspaceId: id,
      workspaces: [ws],
    };
  }

  if (parsed.posts?.length) {
    const id = newWorkspaceId();
    const ws: PersonaWorkspace = {
      id,
      label: persona.name || "当前人设",
      persona,
      updatedAt: new Date().toISOString(),
      calendarStart: parsed.calendarStart || defaultCalendarStart(),
      scheduleAsOf: parsed.scheduleAsOf || todayLocal(),
      posts: parsed.posts,
      weekMeta: parsed.weekMeta ?? [],
      insights: parsed.insights ?? [],
      selectedPostId: parsed.selectedPostId ?? parsed.posts[0]?.id ?? null,
      feedback: parsed.feedback ?? [],
      weights: { ...DEFAULT_WEIGHTS, ...(parsed.weights ?? {}) },
      pending: parsed.pending ?? null,
      snapshots: parsed.snapshots ?? [],
      chat: parsed.chat?.length ? parsed.chat : [welcomeChat(persona)],
    };
    return {
      version: 4,
      activeWorkspaceId: id,
      workspaces: [ws],
      ...mirrorFromWorkspace(ws),
    };
  }

  return fallback;
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(syncActiveWorkspace(state)));
}

export function exportState(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function importState(json: string): AppState {
  const parsed = JSON.parse(json) as Partial<AppState> & { version: number };
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
