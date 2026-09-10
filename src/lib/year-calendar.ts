import {
  CALENDAR_START,
  defaultPostsPerWeek,
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
  format: "story" | "tips" | "emotion";
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

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function mondayOnOrBefore(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function takeTopic(
  pillar: PillarId,
  seeds: Record<PillarId, TopicSeed[]>,
  used: Set<string>,
  cursor: Record<PillarId, number>,
  week: number,
  indexInWeek: number,
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
  return synthesizeTopic(pillar, week, indexInWeek, used);
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
): TopicSeed {
  const pool =
    pillar === "life"
      ? LIFE_NOMINALS
      : JOB_NOMINALS[pillar as Exclude<PillarId, "life">];
  const nominal = pool[(week * 3 + indexInWeek) % pool.length];
  let title =
    pillar === "life"
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
    angle:
      pillar === "life"
        ? `用「${nominal}」这一件具体事丰满人物形象，轻连主线但不抢戏`
        : `围绕「${nominal}」给出当周可执行动作与一句信任锚点`,
    format: pillar === "life" ? "story" : week % 2 === 0 ? "tips" : "story",
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
    if (phase === 1) {
      const seq: PillarId[] = ["life", "restart", "life", "choice"];
      return seq[(week - 1) % seq.length];
    }
    if (indexInWeek === 0 && week % 3 !== 0) return "life";
    if (indexInWeek === postsPerWeek - 1) return "life";
    const spice: PillarId[] = ["choice", "rejection", "resume", "interview", "life"];
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

export function buildYearCalendar(
  startDate: string = CALENDAR_START,
  persona?: CreatorPersona,
): YearCalendar {
  const weekStart0 = mondayOnOrBefore(startDate);
  const weeks: WeekPlan[] = [];
  const posts: CalendarPost[] = [];
  const usedTitles = new Set<string>();
  const seeds = persona?.topicSeeds;
  const cursor = {
    restart: 0,
    "age-edu": 0,
    resume: 0,
    interview: 0,
    rejection: 0,
    choice: 0,
    life: 0,
  } as Record<PillarId, number>;
  const mix = persona?.contentMix ?? "job";
  const trustAnchors = persona?.trustAnchors?.length
    ? persona.trustAnchors
    : ["我只写这一周真实发生的动作"];
  const hookTag = persona ? personaHookTag(persona) : "创作者";

  for (let week = 1; week <= 52; week++) {
    const weekStart = addDays(weekStart0, (week - 1) * 7);
    const phase = phaseForWeek(week, persona);
    const postsPerWeek = defaultPostsPerWeek(week);
    const weekPosts: CalendarPost[] = [];

    for (let i = 0; i < postsPerWeek; i++) {
      const pillar = pillarForSlot(phase, week, i, postsPerWeek, mix);
      const topic = seeds
        ? takeTopic(pillar, seeds, usedTitles, cursor, week, i)
        : synthesizeTopic(pillar, week, i, usedTitles);
      const trustAnchor =
        pillar === "life" || (phase === 1 && topic.format === "story")
          ? undefined
          : trustAnchors[(week + i) % trustAnchors.length];

      const post: CalendarPost = {
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
      };
      weekPosts.push(post);
      posts.push(post);
    }

    weeks.push({ week, weekStart, phase, postsPerWeek, posts: weekPosts });
  }

  const titles = posts.map((p) => p.titleHint);
  if (new Set(titles).size !== titles.length) {
    console.warn("calendar title collision detected");
  }

  return { startDate, weeks, posts };
}
