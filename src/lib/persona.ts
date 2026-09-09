export const CALENDAR_START = "2026-09-09";

export type PhaseId = 1 | 2 | 3 | 4;

export type PillarId =
  | "restart"
  | "age-edu"
  | "resume"
  | "interview"
  | "rejection"
  | "choice";

export const PILLARS: {
  id: PillarId;
  label: string;
  keywords: string[];
}[] = [
  {
    id: "restart",
    label: "重启叙事",
    keywords: ["离职", "重启", "辞职", "重新开始", "离开", "断崖", "空白期"],
  },
  {
    id: "age-edu",
    label: "双非与年龄",
    keywords: ["双非", "年龄", "37", "三十七", "学历", "本科", "大龄", "稳定"],
  },
  {
    id: "resume",
    label: "简历与作品",
    keywords: ["简历", "作品集", "投递", "STAR", "岗位", "匹配", "改简历", "海投"],
  },
  {
    id: "interview",
    label: "面试现场",
    keywords: ["面试", "HR", "自我介绍", "一面", "二面", "终面", "问答", "紧张"],
  },
  {
    id: "rejection",
    label: "拒信与复盘",
    keywords: ["拒信", "挂了", "没过", "复盘", "拒绝", "石沉大海", "已读不回"],
  },
  {
    id: "choice",
    label: "选择与边界",
    keywords: ["offer", "试岗", "谈薪", "入职", "对比", "边界", "选择", "试用期"],
  },
];

export const PHASES: {
  id: PhaseId;
  label: string;
  weekFrom: number;
  weekTo: number;
  focus: string;
}[] = [
  {
    id: 1,
    label: "建立信任",
    weekFrom: 1,
    weekTo: 4,
    focus: "人设可信度：双非/37岁/离职重启切片，并与简历焦虑并行",
  },
  {
    id: 2,
    label: "简历与焦虑",
    weekFrom: 5,
    weekTo: 20,
    focus: "简历、作品集、投递、等待、年龄与学历焦虑",
  },
  {
    id: 3,
    label: "offer与试岗",
    weekFrom: 21,
    weekTo: 36,
    focus: "面试深水区、谈薪、Offer对比、试岗与入职前",
  },
  {
    id: 4,
    label: "叙事收束",
    weekFrom: 37,
    weekTo: 52,
    focus: "适应或再出发、边界感、一年复盘、下一年命题",
  },
];

export const PERSONA = {
  name: "重启求职博主",
  age: 37,
  gender: "女",
  education: "双非本科",
  stage: "已在找工作：简历打磨 + 求职焦虑",
  voice:
    "真诚、克制煽情、有具体动作与复盘；现在时叙述，不假装还在离职当天；不做成功学鸡汤。",
  audience: "30+ 想重启/正在求职、在意年龄与学历标签的女性",
} as const;

export const TRUST_ANCHORS = [
  "双非被追问学历时，我怎么把经历讲清楚",
  "37岁被问稳定性，我只回答可验证的事实",
  "离职原因一句话：不是逃离，是主动重启",
  "空白期怎么写进自我介绍，而不像在辩解",
  "我不卖鸡汤：只分享这一周真实发生的动作",
];

export function pillarLabel(id: PillarId): string {
  return PILLARS.find((p) => p.id === id)?.label ?? id;
}

export function phaseLabel(id: PhaseId): string {
  return PHASES.find((p) => p.id === id)?.label ?? `阶段${id}`;
}

export function phaseForWeek(week: number): PhaseId {
  if (week <= 4) return 1;
  if (week <= 20) return 2;
  if (week <= 36) return 3;
  return 4;
}

/** Early weeks 3–4 posts; later steady 2–3. Defaults use mid values. */
export function defaultPostsPerWeek(week: number): number {
  if (week <= 4) return 4;
  if (week <= 12) return 3;
  return 3;
}
