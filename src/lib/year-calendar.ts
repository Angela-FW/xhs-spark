import {
  CALENDAR_START,
  PERSONA,
  TRUST_ANCHORS,
  defaultPostsPerWeek,
  phaseForWeek,
  type PhaseId,
  type PillarId,
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

const BANK: Record<
  PillarId,
  { titles: string[]; angles: string[]; hooks: string[] }
> = {
  restart: {
    titles: [
      "37岁离职后，我没有立刻「成功重启」",
      "已经走到改简历这一步了，回看离职那天",
      "空白期第三周：我每天只做三件小事",
      "重启不是鸡汤，是把生活重新排日程",
      "我不赶着证明自己，先把话说清楚",
    ],
    angles: [
      "用现在时讲述：我已在求职中，短回顾离职动机",
      "把「重启」落成可执行的一周动作清单",
      "承认混乱，同时展示边界：什么不做",
    ],
    hooks: ["不是励志，是记账", "先稳住再加速", "给同路人一个真实切片"],
  },
  "age-edu": {
    titles: [
      "双非+37岁，面试里我这样回答学历问题",
      "被问「是不是不够稳定」时，我怎么接",
      "年龄焦虑来的那天，我做了这份对照表",
      "别和22岁比速度，比的是可交付结果",
      "学历污名化：我把经历改写成证据链",
    ],
    angles: [
      "把标签拆成可验证事实，而不是情绪辩护",
      "给同龄求职者一套「被追问」话术骨架",
      "承认焦虑，同时给一个本周小行动",
    ],
    hooks: ["标签不是判决书", "话术要可复用", "先过自己心里那关"],
  },
  resume: {
    titles: [
      "这周我把简历砍掉了40%",
      "STAR写到第三版，我才看懂岗位要什么",
      "海投很累：我改成「每天5个精准投」",
      "作品集不是美图，是问题-动作-结果",
      "岗位JD对照表：我怎么筛「可投/别投」",
      "等回复的72小时，我用日程对抗焦虑",
    ],
    angles: [
      "展示具体改动前后对比（脱敏）",
      "把焦虑转成投递节奏与复盘表",
      "教读者做岗位匹配，而不是盲目海投",
    ],
    hooks: ["少即是多", "匹配度>数量", "焦虑要有出口"],
  },
  interview: {
    titles: [
      "一面翻车后，我重写了自我介绍60秒版",
      "HR爱问的三句话，我的诚实答法",
      "面试紧张手抖：我用的开场缓冲句",
      "二面被追问空白期，我这样拆开讲",
      "模拟面试录音：我听到的三个问题",
    ],
    angles: [
      "现场细节+可改的话术，不装从容",
      "把面试当信息交换，而非审判",
      "一次只改一个变量：介绍/案例/提问",
    ],
    hooks: ["现场感", "可抄作业", "翻车也可复盘"],
  },
  rejection: {
    titles: [
      "又收到拒信：我只复盘三个问题",
      "石沉大海的投递，我决定停掉这类岗位",
      "「已读不回」那天，我给自己的止损规则",
      "拒信不是否定全部，是匹配失败的数据",
      "连续两周低回复率：我改了渠道而不是人格",
    ],
    angles: [
      "情绪先落地，再抽取可行动结论",
      "用数据看渠道/岗位类型，而不是自我攻击",
      "公开止损规则，帮读者减少空耗",
    ],
    hooks: ["止损比硬扛重要", "数据安慰人", "下次怎么投"],
  },
  choice: {
    titles: [
      "两个offer怎么比：我列的不是薪资一张表",
      "试岗第三天：我在观察边界而不是讨好",
      "谈薪前我准备的三句话底线",
      "入职前夜的焦虑，我用「前30天计划」安放",
      "选择留下或离开：我的非情绪清单",
    ],
    angles: [
      "决策框架：钱/成长/身体/尊重",
      "试岗当双向考察，写出观察维度",
      "谈薪与边界用事先写好的句子",
    ],
    hooks: ["选择有成本", "边界先于勤奋", "试岗是考试双方"],
  },
};

function pick<T>(arr: T[], n: number): T {
  return arr[((n % arr.length) + arr.length) % arr.length];
}

function pillarForSlot(
  phase: PhaseId,
  week: number,
  indexInWeek: number,
  postsPerWeek: number,
): { pillar: PillarId; format: CalendarPost["format"] } {
  // Phase 1: 1 trust narrative + rest resume/anxiety
  if (phase === 1) {
    if (indexInWeek === 0) {
      return {
        pillar: indexInWeek % 2 === 0 ? "restart" : "age-edu",
        format: "story",
      };
    }
    if (indexInWeek === 1) {
      return { pillar: "age-edu", format: week % 2 === 0 ? "emotion" : "story" };
    }
    return { pillar: "resume", format: "tips" };
  }

  if (phase === 2) {
    const cycle: { pillar: PillarId; format: CalendarPost["format"] }[] = [
      { pillar: "resume", format: "tips" },
      { pillar: "age-edu", format: "emotion" },
      { pillar: "resume", format: "tips" },
      { pillar: "rejection", format: "story" },
      { pillar: "interview", format: "tips" },
    ];
    return pick(cycle, week * 3 + indexInWeek);
  }

  if (phase === 3) {
    const cycle: { pillar: PillarId; format: CalendarPost["format"] }[] = [
      { pillar: "interview", format: "tips" },
      { pillar: "rejection", format: "story" },
      { pillar: "choice", format: "tips" },
      { pillar: "interview", format: "story" },
      { pillar: "choice", format: "emotion" },
    ];
    return pick(cycle, week * 3 + indexInWeek);
  }

  // phase 4
  const cycle: { pillar: PillarId; format: CalendarPost["format"] }[] = [
    { pillar: "restart", format: "story" },
    { pillar: "choice", format: "tips" },
    { pillar: "age-edu", format: "emotion" },
    { pillar: "choice", format: "story" },
  ];
  return pick(cycle, week * postsPerWeek + indexInWeek);
}

export function buildYearCalendar(
  startDate: string = CALENDAR_START,
): YearCalendar {
  const weekStart0 = mondayOnOrBefore(startDate);
  const weeks: WeekPlan[] = [];
  const posts: CalendarPost[] = [];

  for (let week = 1; week <= 52; week++) {
    const weekStart = addDays(weekStart0, (week - 1) * 7);
    const phase = phaseForWeek(week);
    const postsPerWeek = defaultPostsPerWeek(week);
    const weekPosts: CalendarPost[] = [];

    for (let i = 0; i < postsPerWeek; i++) {
      const { pillar, format } = pillarForSlot(phase, week, i, postsPerWeek);
      const bank = BANK[pillar];
      const seed = week * 10 + i;
      const trustAnchor =
        phase === 1 && format === "story"
          ? undefined
          : pick(TRUST_ANCHORS, seed);

      const post: CalendarPost = {
        id: `w${week}-p${i + 1}`,
        week,
        weekStart,
        indexInWeek: i,
        phase,
        pillar,
        titleHint: pick(bank.titles, seed),
        angle: pick(bank.angles, seed + 1),
        hooks: [
          pick(bank.hooks, seed),
          pick(bank.hooks, seed + 1),
          `${PERSONA.age}岁·${PERSONA.education}`,
        ],
        trustAnchor,
        materials: [],
        status: "planned",
        format,
      };
      weekPosts.push(post);
      posts.push(post);
    }

    weeks.push({ week, weekStart, phase, postsPerWeek, posts: weekPosts });
  }

  return { startDate, weeks, posts };
}
