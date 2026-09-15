import {
  CALENDAR_START,
  defaultPostsPerWeek,
  domainNominalsForPersona,
  ensurePersonaTopicSeeds,
  phaseForWeek,
  personaHookTag,
  type ContentMix,
  type CreatorPersona,
  type PhaseId,
  type PillarId,
  type TopicSeed,
} from "./persona";

export type PostStatus = "planned" | "drafted" | "published";

export type PostMaterial = {
  id: string;
  summary: string;
  polished: string;
  sourceInsightId?: string;
};

/** Saved generate-panel draft, restored when reopening 生成. */
export type PostDraft = {
  titles: string[];
  titleIndex: number;
  body: string;
  tags: string[];
  extra?: string;
};

export type CalendarPost = {
  id: string;
  week: number;
  weekStart: string;
  indexInWeek: number;
  phase: PhaseId;
  pillar: PillarId;
  titleHint: string;
  angle: string;
  hooks: string[];
  trustAnchor?: string;
  materials: PostMaterial[];
  status: PostStatus;
  /** Real local YYYY-MM-DD when marked published; frozen thereafter. */
  publishedAt?: string;
  format: "story" | "tips" | "emotion";
  draft?: PostDraft;
};

export type WeekPlan = {
  week: number;
  weekStart: string;
  phase: PhaseId;
  postsPerWeek: number;
  posts: CalendarPost[];
};

export type YearCalendar = {
  startDate: string;
  weeks: WeekPlan[];
  posts: CalendarPost[];
};

export function parseLocalYmd(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayLocal(from = new Date()): string {
  return formatLocalYmd(from);
}

export function addDays(iso: string, days: number): string {
  const d = parseLocalYmd(iso);
  d.setDate(d.getDate() + days);
  return formatLocalYmd(d);
}

export function diffCalendarDays(fromIso: string, toIso: string): number {
  const from = parseLocalYmd(fromIso).getTime();
  const to = parseLocalYmd(toIso).getTime();
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

/** First Monday on or after `iso` — week 1 stays in the present/future. */
export function mondayOnOrAfter(iso: string): string {
  const d = parseLocalYmd(iso);
  const day = d.getDay();
  const diff = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  d.setDate(d.getDate() + diff);
  return formatLocalYmd(d);
}

/** Monday of the week that contains `iso` (Mon–Sun). */
export function mondayOfContainingWeek(iso: string): string {
  const d = parseLocalYmd(iso);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return formatLocalYmd(d);
}

function laterYmd(a: string, b: string): string {
  return a >= b ? a : b;
}

/**
 * Published weeks freeze on mondayOnOrAfter(first publishedAt).
 * Weeks with no published notes pack onto consecutive Mondays,
 * never earlier than this week's Monday.
 */
export function assignWeekMondays(
  posts: CalendarPost[],
  today = todayLocal(),
): { posts: CalendarPost[]; calendarStart: string } {
  const thisMonday = mondayOfContainingWeek(today);
  const byWeek = new Map<number, CalendarPost[]>();
  for (const post of posts) {
    const list = byWeek.get(post.week) ?? [];
    list.push(post);
    byWeek.set(post.week, list);
  }
  const weeks = [...byWeek.keys()].sort((a, b) => a - b);
  const locked = weeks.filter((week) =>
    byWeek.get(week)!.some((post) => post.status === "published"),
  );
  const open = weeks.filter((week) =>
    byWeek.get(week)!.every((post) => post.status !== "published"),
  );

  const starts = new Map<number, string>();
  for (const week of locked) {
    const earliest = byWeek
      .get(week)!
      .map((post) => post.publishedAt)
      .filter((d): d is string => Boolean(d))
      .sort()[0];
    starts.set(week, earliest ? mondayOnOrAfter(earliest) : thisMonday);
  }

  const lastLocked = locked[locked.length - 1];
  const lastLockedMonday =
    lastLocked != null ? starts.get(lastLocked)! : addDays(thisMonday, -7);
  const firstOpenMonday = laterYmd(addDays(lastLockedMonday, 7), thisMonday);
  open.forEach((week, index) => {
    starts.set(week, addDays(firstOpenMonday, index * 7));
  });

  return {
    posts: posts.map((post) => ({
      ...post,
      weekStart: starts.get(post.week) ?? post.weekStart,
    })),
    calendarStart: starts.get(1) ?? thisMonday,
  };
}

/** Week 1 starts at `week1Start`. Dates before that clamp to week 1. */
export function weekNumberForDate(week1Start: string, iso: string): number {
  const days = diffCalendarDays(week1Start, iso);
  if (days < 0) return 1;
  return Math.floor(days / 7) + 1;
}

/**
 * Monday that week 1 should keep for published notes.
 * Unpublished dates may drift forward; don't let that rewrite history.
 */
export function publishedWeekOrigin(
  calendarStart: string,
  publishedDates: string[],
): string {
  if (!publishedDates.length) return calendarStart;
  const earliest = publishedDates.reduce((a, b) => (a < b ? a : b));
  return earliest < calendarStart ? mondayOnOrAfter(earliest) : calendarStart;
}

export function weekStartForWeek(week1Start: string, week: number): string {
  return addDays(week1Start, Math.max(0, week - 1) * 7);
}

export function uniqueCalendarPostId(
  existingIds: Set<string>,
  week: number,
  indexInWeek: number,
): string {
  const base = `w${week}-p${indexInWeek + 1}`;
  if (!existingIds.has(base)) {
    existingIds.add(base);
    return base;
  }
  let n = 2;
  while (existingIds.has(`${base}-${n}`)) n += 1;
  const id = `${base}-${n}`;
  existingIds.add(id);
  return id;
}

export function isCalendarStartInPast(
  calendarStart: string,
  today = new Date(),
): boolean {
  const start = parseLocalYmd(calendarStart);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return start.getTime() < t.getTime();
}

function takeTopic(
  pillar: PillarId,
  seeds: Record<PillarId, TopicSeed[]>,
  used: Set<string>,
  cursor: Record<PillarId, number>,
  week: number,
  indexInWeek: number,
  persona?: CreatorPersona,
): TopicSeed {
  const list = seeds[pillar] ?? [];
  if (list.length) {
    let guard = 0;
    while (guard < list.length * 2) {
      const idx = cursor[pillar] % list.length;
      cursor[pillar] += 1;
      const topic = list[idx];
      if (!used.has(topic.title)) {
        used.add(topic.title);
        return {
          ...topic,
          hooks: [...topic.hooks] as [string, string],
        };
      }
      guard += 1;
    }
  }
  return synthesizeTopic(pillar, week, indexInWeek, used, persona);
}

const LIFE_NOMINALS = [
  "晨跑",
  "咖啡",
  "图书馆",
  "菜市场",
  "旧衣服清理",
  "牙科预约",
  "短途出行",
  "手帐",
  "拉伸",
  "午睡",
  "浇花",
  "回消息边界",
  "电影夜",
  "素食一周",
  "断舍离抽屉",
  "耳机歌单",
  "公交一站路",
  "明信片",
  "修鞋",
  "剪发",
  "阳台晒被子",
  "关掉工作群免打扰",
  "给自己买花",
  "整理云盘",
];

const JOB_NOMINALS: Record<Exclude<PillarId, "life">, string[]> = {
  restart: [
    "重启周记",
    "身份声明",
    "停止清单",
    "口述练习",
    "日程重排",
    "动机复核",
  ],
  "age-edu": [
    "学历答法",
    "稳定性证据",
    "年龄对照",
    "空窗时间线",
    "标签改写",
    "同龄落差",
  ],
  resume: [
    "简历删改",
    "JD对照",
    "投递节奏",
    "作品集结构",
    "渠道复盘",
    "成果句式",
    "一页纸检查",
    "转岗取舍",
  ],
  interview: [
    "自我介绍",
    "反问设计",
    "故事库",
    "线上面试",
    "群面节奏",
    "紧张缓冲",
  ],
  rejection: ["拒信归档", "止损规则", "情绪出口", "渠道止损", "终面复盘"],
  choice: ["offer四维", "试岗观察", "谈薪底线", "前30天", "可退出条件"],
};

function synthesizeTopic(
  pillar: PillarId,
  week: number,
  indexInWeek: number,
  used: Set<string>,
  persona?: CreatorPersona,
): TopicSeed {
  const useCreatorDomain =
    persona?.contentMix === "life" || persona?.presetId === "custom";
  const pool = useCreatorDomain
    ? domainNominalsForPersona(persona!)
    : pillar === "life"
      ? LIFE_NOMINALS
      : JOB_NOMINALS[pillar as Exclude<PillarId, "life">];
  const nominal = pool[(week * 3 + indexInWeek) % pool.length];
  let title = useCreatorDomain
    ? pillar === "life" || pillar === "restart"
      ? `第${week}周｜${nominal}`
      : `第${week}周取舍｜${nominal}`
    : pillar === "life"
      ? `第${week}周生活切片：${nominal}`
      : `第${week}周｜${nominal}（不重复纪录 ${week}-${indexInWeek + 1}）`;
  let n = 2;
  while (used.has(title)) {
    title = `${title.replace(/（.*）$/, "")}（v${n}）`;
    n += 1;
  }
  used.add(title);
  return {
    title,
    angle: useCreatorDomain
      ? `围绕「${nominal}」写出可执行的一周动作，贴合「${persona?.name || "创作者"}」人设`
      : pillar === "life"
        ? `用「${nominal}」这一件具体事丰满人物形象，轻连主线但不抢戏`
        : `围绕「${nominal}」给出当周可执行动作与一句信任锚点`,
    format:
      useCreatorDomain || pillar === "life"
        ? week % 3 === 0
          ? "tips"
          : "story"
        : week % 2 === 0
          ? "tips"
          : "story",
    hooks: [nominal, `W${week}`],
  };
}

function pillarForSlot(
  phase: PhaseId,
  week: number,
  indexInWeek: number,
  postsPerWeek: number,
  mix: ContentMix,
): PillarId {
  if (mix === "life") {
    // Stay in life-domain pillars — never spice with resume/interview/谈薪.
    if (phase === 1) {
      const seq: PillarId[] = ["life", "restart", "life", "life"];
      return seq[(week - 1) % seq.length];
    }
    if (indexInWeek === 0) return "life";
    if (indexInWeek === postsPerWeek - 1 && week % 2 === 0) return "choice";
    const spice: PillarId[] = ["life", "life", "restart", "choice", "life"];
    return spice[(week + indexInWeek) % spice.length];
  }

  if (mix === "career") {
    if (phase === 1) {
      const seq: PillarId[] = ["restart", "resume", "life", "restart"];
      return seq[(week - 1) % seq.length];
    }
    if (phase === 2) {
      if (indexInWeek === 1) return "life";
      const job: PillarId[] = ["resume", "interview", "resume", "choice", "rejection"];
      return job[(week + indexInWeek) % job.length];
    }
    if (phase === 3) {
      if (indexInWeek === postsPerWeek - 1 && week % 2 === 0) return "life";
      const job: PillarId[] = ["interview", "choice", "resume", "interview", "choice"];
      return job[(week + indexInWeek) % job.length];
    }
    if (indexInWeek === 1 || (postsPerWeek === 1 && week % 3 === 0)) return "life";
    const wrap: PillarId[] = ["restart", "choice", "resume", "choice"];
    return wrap[(week + indexInWeek) % wrap.length];
  }

  // job mix (default)
  if (phase === 1) {
    const seq: PillarId[] = ["restart", "age-edu", "life", "restart"];
    return seq[(week - 1) % seq.length];
  }

  if (phase === 2) {
    if (postsPerWeek === 1) return week % 2 === 0 ? "resume" : "life";
    if (indexInWeek === 1) return "life";
    const job: PillarId[] = ["resume", "age-edu", "resume", "interview", "rejection"];
    return job[(week + indexInWeek) % job.length];
  }

  if (phase === 3) {
    if (indexInWeek === postsPerWeek - 1 && week % 2 === 0) return "life";
    const job: PillarId[] = ["interview", "rejection", "choice", "interview", "choice"];
    return job[(week + indexInWeek) % job.length];
  }

  if (indexInWeek === 1 || (postsPerWeek === 1 && week % 3 === 0)) return "life";
  const wrap: PillarId[] = ["restart", "choice", "age-edu", "choice"];
  return wrap[(week + indexInWeek) % wrap.length];
}

export function buildWeekPosts(options: {
  week: number;
  weekStart: string;
  persona?: CreatorPersona;
  usedTitles?: Set<string>;
  cursor?: Record<PillarId, number>;
}): { week: WeekPlan; posts: CalendarPost[] } {
  const ready = options.persona
    ? ensurePersonaTopicSeeds(options.persona)
    : undefined;
  const week = options.week;
  const weekStart = options.weekStart;
  const usedTitles = options.usedTitles ?? new Set<string>();
  const cursor =
    options.cursor ??
    ({
      restart: week * 2,
      "age-edu": week * 2,
      resume: week * 2,
      interview: week * 2,
      rejection: week * 2,
      choice: week * 2,
      life: week * 2,
    } as Record<PillarId, number>);
  const seeds = ready?.topicSeeds;
  const mix = ready?.contentMix ?? "job";
  const trustAnchors = ready?.trustAnchors?.length
    ? ready.trustAnchors
    : ["我只写这一周真实发生的动作"];
  const hookTag = ready ? personaHookTag(ready) : "创作者";
  const phase = phaseForWeek(week, ready);
  const postsPerWeek = defaultPostsPerWeek(week);
  const weekPosts: CalendarPost[] = [];

  for (let i = 0; i < postsPerWeek; i++) {
    const pillar = pillarForSlot(phase, week, i, postsPerWeek, mix);
    const topic = seeds
      ? takeTopic(pillar, seeds, usedTitles, cursor, week, i, ready)
      : synthesizeTopic(pillar, week, i, usedTitles, ready);
    const trustAnchor =
      pillar === "life" || (phase === 1 && topic.format === "story")
        ? undefined
        : trustAnchors[(week + i) % trustAnchors.length];

    weekPosts.push({
      id: `w${week}-p${i + 1}`,
      week,
      weekStart,
      indexInWeek: i,
      phase,
      pillar,
      titleHint: topic.title,
      angle: topic.angle,
      hooks: [...topic.hooks, hookTag],
      trustAnchor,
      materials: [],
      status: "planned",
      format: topic.format,
    });
  }

  return {
    week: {
      week,
      weekStart,
      phase,
      postsPerWeek,
      posts: weekPosts,
    },
    posts: weekPosts,
  };
}

export function buildYearCalendar(
  startDate: string = CALENDAR_START,
  persona?: CreatorPersona,
  weekCount = 52,
): YearCalendar {
  const ready = persona ? ensurePersonaTopicSeeds(persona) : undefined;
  const weekStart0 = mondayOnOrAfter(startDate);
  const weeks: WeekPlan[] = [];
  const posts: CalendarPost[] = [];
  const usedTitles = new Set<string>();
  const cursor = {
    restart: 0,
    "age-edu": 0,
    resume: 0,
    interview: 0,
    rejection: 0,
    choice: 0,
    life: 0,
  } as Record<PillarId, number>;

  for (let week = 1; week <= weekCount; week++) {
    const weekStart = addDays(weekStart0, (week - 1) * 7);
    const built = buildWeekPosts({
      week,
      weekStart,
      persona: ready,
      usedTitles,
      cursor,
    });
    weeks.push(built.week);
    posts.push(...built.posts);
  }

  const titles = posts.map((p) => p.titleHint);
  if (new Set(titles).size !== titles.length) {
    console.warn("calendar title collision detected");
  }

  return { startDate: weekStart0, weeks, posts };
}
