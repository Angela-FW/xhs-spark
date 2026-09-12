/** @deprecated Prefer defaultCalendarStart() — kept for import compatibility. */
export const CALENDAR_START = "2026-09-09";

/** Next Monday on/after today (local), so week 1 never starts in the past. */
export function defaultCalendarStart(from = new Date()): string {
  const y = from.getFullYear();
  const m = String(from.getMonth() + 1).padStart(2, "0");
  const d = String(from.getDate()).padStart(2, "0");
  return mondayOnOrAfterLocal(`${y}-${m}-${d}`);
}

function mondayOnOrAfterLocal(iso: string): string {
  const [y, m, day] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, day);
  const dow = date.getDay();
  const diff = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
  date.setDate(date.getDate() + diff);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export type PhaseId = 1 | 2 | 3 | 4;

export type PillarId =
  | "restart"
  | "age-edu"
  | "resume"
  | "interview"
  | "rejection"
  | "choice"
  | "life";

export type PresetId =
  | "home"
  | "auto"
  | "resign"
  | "career-daily"
  | "life-journal"
  | "custom"
  /** @deprecated migrated to resign */
  | "job-restart"
  /** @deprecated migrated to career-daily */
  | "career-growth";

/** Map legacy preset ids from older local/cloud state. */
export function normalizePresetId(id: string | undefined | null): PresetId {
  if (id === "job-restart") return "resign";
  if (id === "career-growth") return "career-daily";
  if (
    id === "home" ||
    id === "auto" ||
    id === "resign" ||
    id === "career-daily" ||
    id === "life-journal" ||
    id === "custom"
  ) {
    return id;
  }
  return "life-journal";
}

export type TopicSeed = {
  title: string;
  angle: string;
  format: "story" | "tips" | "emotion";
  hooks: [string, string];
};

export type PhaseDef = {
  id: PhaseId;
  label: string;
  weekFrom: number;
  weekTo: number;
  focus: string;
};

export type ContentMix = "job" | "career" | "life";

export type CreatorPersona = {
  presetId: PresetId;
  name: string;
  age: number;
  gender: string;
  background: string;
  stage: string;
  voice: string;
  audience: string;
  trustAnchors: string[];
  topicSeeds: Record<PillarId, TopicSeed[]>;
  phases: PhaseDef[];
  noteTags: string[];
  contentMix: ContentMix;
};

/** User-saved custom personas (shown next to system presets). */
export type SavedPersonaSlot = {
  id: string;
  label: string;
  persona: CreatorPersona;
  updatedAt: string;
};

export const MAX_SAVED_PERSONAS = 10;

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
  {
    id: "life",
    label: "生活进展",
    keywords: [
      "生活",
      "日常",
      "搬家",
      "作息",
      "身体",
      "朋友",
      "家庭",
      "散步",
      "做饭",
      "情绪管理",
      "人物",
    ],
  },
];

const JOB_PHASES: PhaseDef[] = [
  {
    id: 1,
    label: "建立信任",
    weekFrom: 1,
    weekTo: 4,
    focus: "第一个月慢热：每周1篇，把人设讲清楚，不堆量",
  },
  {
    id: 2,
    label: "简历与焦虑",
    weekFrom: 5,
    weekTo: 20,
    focus: "第二个月起提频；求职干货与生活进展穿插，丰满人物形象",
  },
  {
    id: 3,
    label: "offer与试岗",
    weekFrom: 21,
    weekTo: 36,
    focus: "面试深水区、谈薪、Offer/试岗，同时保留生活切片",
  },
  {
    id: 4,
    label: "叙事收束",
    weekFrom: 37,
    weekTo: 52,
    focus: "适应或再出发、边界感、一年复盘；生活与选择并置",
  },
];

const CAREER_PHASES: PhaseDef[] = [
  {
    id: 1,
    label: "站稳脚跟",
    weekFrom: 1,
    weekTo: 4,
    focus: "先讲清你是谁、在做什么，建立可信职场人设",
  },
  {
    id: 2,
    label: "能力与协作",
    weekFrom: 5,
    weekTo: 20,
    focus: "方法论、协作、反馈循环；穿插生活，避免只剩鸡汤",
  },
  {
    id: 3,
    label: "影响与晋升",
    weekFrom: 21,
    weekTo: 36,
    focus: "影响力、向上管理、机会选择；保留真实疲惫与边界",
  },
  {
    id: 4,
    label: "长期主义",
    weekFrom: 37,
    weekTo: 52,
    focus: "复盘一年成长、角色变化与可持续节奏",
  },
];

const LIFE_PHASES: PhaseDef[] = [
  {
    id: 1,
    label: "认识我",
    weekFrom: 1,
    weekTo: 4,
    focus: "慢热开场：生活节奏、审美与价值观",
  },
  {
    id: 2,
    label: "日常深挖",
    weekFrom: 5,
    weekTo: 20,
    focus: "具体场景、人物关系、小习惯；少口号多动作",
  },
  {
    id: 3,
    label: "关系与选择",
    weekFrom: 21,
    weekTo: 36,
    focus: "边界、亲密关系、取舍；保留轻松切片",
  },
  {
    id: 4,
    label: "一年回望",
    weekFrom: 37,
    weekTo: 52,
    focus: "季节感、变化与未完成清单",
  },
];

/** 图文起号通用阶段：前 4 周破冰+价值，后面互动与长线。 */
const LAUNCH_PHASES: PhaseDef[] = [
  {
    id: 1,
    label: "破冰认识我",
    weekFrom: 1,
    weekTo: 2,
    focus: "人设亮相与共鸣切片，先让人记住你是谁",
  },
  {
    id: 2,
    label: "价值站稳",
    weekFrom: 3,
    weekTo: 4,
    focus: "可带走的方法/清单，建立专业信任，服务涨粉",
  },
  {
    id: 3,
    label: "互动加深",
    weekFrom: 5,
    weekTo: 12,
    focus: "系列栏目、评论区话题、稳定更新节奏",
  },
  {
    id: 4,
    label: "长线经营",
    weekFrom: 13,
    weekTo: 52,
    focus: "深挖细分选题，沉淀人设资产",
  },
];

/** Default phase list for helpers that don't yet take a persona. */
export const PHASES = JOB_PHASES;

const JOB_TRUST = [
  "双非被追问学历时，我怎么把经历讲清楚",
  "37岁被问稳定性，我只回答可验证的事实",
  "离职原因一句话：不是逃离，是主动重启",
  "空白期怎么写进自我介绍，而不像在辩解",
  "我不卖鸡汤：只分享这一周真实发生的动作",
  "生活没有停摆：求职之外我仍在维持节律",
];

const CAREER_TRUST = [
  "我用结果说话，不靠职级吓唬人",
  "开会前我会先写清「要什么决定」",
  "反馈来了，我先拆事实再谈感受",
  "晋升叙事里，我只写可验证贡献",
  "忙不是勋章，完成闭环才是",
  "生活节律坏了，工作输出也会塌",
];

const LIFE_TRUST = [
  "我不装精致，只写真的做过的小事",
  "情绪可以有，但不绑架读者",
  "生活记录也要有一句可带走的具体动作",
  "人物出场要脱敏，关系要真实",
  "季节变化写进日常，不写空洞感悟",
  "边界感：哪些能公开，哪些只留给自己",
];

const JOB_SEEDS: Record<PillarId, TopicSeed[]> = {
  restart: [
    {
      title: "37岁离职后，我没有立刻「成功重启」",
      angle: "现在时开场：已在改简历，只用一段回看离职动机",
      format: "story",
      hooks: ["不是励志是记账", "先稳住"],
    },
    {
      title: "离职公告发出去的那天，我只做了三件事",
      angle: "用极具体的一天动作，代替空泛重启宣言",
      format: "story",
      hooks: ["动作可见", "少表演"],
    },
    {
      title: "空白期不等于空白人：我给自己的身份一句话",
      angle: "对外介绍怎么说，才不像在辩解",
      format: "tips",
      hooks: ["一句话身份", "可复用"],
    },
    {
      title: "重启第一个月，我删掉的三件事比新增的更重要",
      angle: "用「停止清单」建立边界感",
      format: "tips",
      hooks: ["停止清单", "边界"],
    },
    {
      title: "有人问我后悔吗？我答了这半句",
      angle: "诚实但不自虐的回答框架",
      format: "emotion",
      hooks: ["半句真相", "不鸡汤"],
    },
    {
      title: "把「找不到工作」改写成「正在匹配中」",
      angle: "语言如何影响一周的行动力",
      format: "emotion",
      hooks: ["措辞", "行动"],
    },
    {
      title: "重启叙事里，我决定永不写的五种开头",
      angle: "反鸡汤清单，建立账号语气边界",
      format: "tips",
      hooks: ["语气边界", "反鸡汤"],
    },
    {
      title: "从「逃离」到「选择」：我怎么改口述离职原因",
      angle: "同一事实的两种讲法对照",
      format: "story",
      hooks: ["口述对照", "选择感"],
    },
  ],
  "age-edu": [
    {
      title: "双非+37岁，我把学历问题拆成三层答",
      angle: "事实层/能力层/匹配层，避免情绪辩护",
      format: "tips",
      hooks: ["三层答法", "可抄"],
    },
    {
      title: "被问稳不稳定时，我只给可验证的证据",
      angle: "用履历密度回答稳定性，不承诺感动",
      format: "tips",
      hooks: ["证据", "稳定性"],
    },
    {
      title: "年龄焦虑来的周日晚上，我做了这张对照表",
      angle: "焦虑可视化：怕什么 vs 我能交付什么",
      format: "emotion",
      hooks: ["对照表", "落地"],
    },
    {
      title: "别和22岁比投递速度，比的是一次说清的能力",
      angle: "换赛道指标，减少无效内耗",
      format: "story",
      hooks: ["换指标", "少内耗"],
    },
    {
      title: "简历上的学校一栏，我这样处理「双非」",
      angle: "版式与措辞：不躲闪也不放大",
      format: "tips",
      hooks: ["版式", "措辞"],
    },
    {
      title: "同龄人还在晋升，我在投简历：我怎么看差距",
      angle: "承认落差，同时列出自己的时间资产",
      format: "emotion",
      hooks: ["落差", "时间资产"],
    },
    {
      title: "「大龄」不是骂人，是提醒我把结果写得更硬",
      angle: "把标签变成写作标准",
      format: "story",
      hooks: ["结果更硬", "标准"],
    },
    {
      title: "HR追问职业空窗，我用时间线回答而不是情绪",
      angle: "空窗月份→学习/项目/求职动作的时间线模板",
      format: "tips",
      hooks: ["时间线", "空窗"],
    },
  ],
  resume: [
    {
      title: "这周简历我砍掉了四成形容词",
      angle: "删改前后对照（脱敏），只留可验证结果",
      format: "tips",
      hooks: ["删改", "结果"],
    },
    {
      title: "STAR写到第三版，我才看懂JD在要什么",
      angle: "用一份JD拆解反推简历条目",
      format: "tips",
      hooks: ["JD反推", "STAR"],
    },
    {
      title: "海投改成每天5个精准投之后发生了什么",
      angle: "数量下降、回复质量上升的一周记录",
      format: "story",
      hooks: ["精准投", "数据"],
    },
    {
      title: "作品集我改成「问题-动作-结果」三页",
      angle: "作品集结构模板，少美图多逻辑",
      format: "tips",
      hooks: ["三页结构", "逻辑"],
    },
    {
      title: "岗位筛选表：可投 / 观望 / 别投",
      angle: "公开我的筛选维度，减少纠结",
      format: "tips",
      hooks: ["筛选表", "减纠结"],
    },
    {
      title: "等回复的72小时，我用日程对抗刷新按钮",
      angle: "等待期日程：学习块+生活块+投递块",
      format: "emotion",
      hooks: ["等待期", "日程"],
    },
    {
      title: "一页纸简历：我删掉的不是内容，是负担",
      angle: "信息层级：必看/可点开/别放",
      format: "tips",
      hooks: ["一页纸", "层级"],
    },
    {
      title: "把「负责过」改成「推动到什么结果」",
      angle: "动词升级清单+示例改写",
      format: "tips",
      hooks: ["动词", "改写"],
    },
    {
      title: "投递渠道复盘：哪个渠道在浪费我",
      angle: "两周渠道数据，决定停投哪里",
      format: "story",
      hooks: ["渠道", "止损"],
    },
    {
      title: "简历投出去前的最后10分钟检查表",
      angle: "可打印检查清单：联系方式/量化/错别字/匹配词",
      format: "tips",
      hooks: ["检查表", "临门"],
    },
    {
      title: "不会写成果？我用「前后对比句」救急",
      angle: "无华丽业绩时的诚实写法",
      format: "tips",
      hooks: ["对比句", "诚实"],
    },
    {
      title: "面向转岗的简历：我保留了什么、放弃了什么",
      angle: "相关性优先于完整履历",
      format: "story",
      hooks: ["转岗", "取舍"],
    },
  ],
  interview: [
    {
      title: "一面翻车后，我重写了60秒自我介绍",
      angle: "翻车点→新版介绍结构",
      format: "story",
      hooks: ["60秒", "翻车复盘"],
    },
    {
      title: "HR常问的三句话，我的诚实答法模板",
      angle: "离职原因/优缺点/为什么选我们",
      format: "tips",
      hooks: ["三句话", "模板"],
    },
    {
      title: "面试前夜手抖：我用的开场缓冲句",
      angle: "生理紧张时的可执行开场",
      format: "emotion",
      hooks: ["缓冲句", "紧张"],
    },
    {
      title: "二面追问空白期，我把时间线摊开讲",
      angle: "现场口述脚本（可删减）",
      format: "tips",
      hooks: ["空白期", "口述"],
    },
    {
      title: "模拟面试录音里，我听到了三个问题",
      angle: "语速/废话/证据不足的自查",
      format: "story",
      hooks: ["录音", "自查"],
    },
    {
      title: "终面前我只准备了「三个故事」",
      angle: "少而硬的故事库，比题海有效",
      format: "tips",
      hooks: ["三故事", "少而硬"],
    },
    {
      title: "被问职业规划，我怎么避免空话",
      angle: "1年可验证目标 + 岗位匹配",
      format: "tips",
      hooks: ["规划", "可验证"],
    },
    {
      title: "线上面试的镜头与背景：我踩过的小坑",
      angle: "设备清单+表达细节",
      format: "tips",
      hooks: ["线上面试", "细节"],
    },
    {
      title: "面试结束我必问的两个问题",
      angle: "信息交换，而不是讨好",
      format: "tips",
      hooks: ["反问", "信息"],
    },
    {
      title: "群面里我不再抢第一句话",
      angle: "大龄求职者的节奏策略",
      format: "story",
      hooks: ["群面", "节奏"],
    },
  ],
  rejection: [
    {
      title: "又收到拒信：我只复盘三个问题",
      angle: "匹配/表达/渠道——每次只改一个",
      format: "tips",
      hooks: ["三问", "单变量"],
    },
    {
      title: "石沉大海的投递，我决定停掉这类岗位",
      angle: "止损规则公开化",
      format: "story",
      hooks: ["止损", "岗位类型"],
    },
    {
      title: "「已读不回」那天，我给自己的情绪出口",
      angle: "允许难过的时段 + 之后的动作",
      format: "emotion",
      hooks: ["情绪出口", "动作"],
    },
    {
      title: "拒信不是否定全部，是一份匹配失败数据",
      angle: "把拒信归档进表格的方法",
      format: "tips",
      hooks: ["数据化", "归档"],
    },
    {
      title: "连续两周低回复率：我改了渠道没改人格",
      angle: "外部变量优先于自我攻击",
      format: "story",
      hooks: ["渠道", "少自攻"],
    },
    {
      title: "感谢信模板我写了，但拒信后我不再秒回",
      angle: "边界：哪些值得跟进",
      format: "tips",
      hooks: ["跟进", "边界"],
    },
    {
      title: "挂在终面：我把失落写成可改的清单",
      angle: "终面失败的拆解框架",
      format: "emotion",
      hooks: ["终面", "清单"],
    },
    {
      title: "拒信周的自我对话：哪句我不再对自己说",
      angle: "清理自我攻击话术",
      format: "emotion",
      hooks: ["自我对话", "清理"],
    },
  ],
  choice: [
    {
      title: "两个offer怎么比：不只是薪资一张表",
      angle: "钱/成长/身体/尊重 四维",
      format: "tips",
      hooks: ["四维", "对比"],
    },
    {
      title: "试岗第三天：我在观察边界而不是讨好",
      angle: "观察清单：会议/反馈/加班文化",
      format: "story",
      hooks: ["试岗", "观察"],
    },
    {
      title: "谈薪前我准备的三句底线",
      angle: "事先写好，现场少即兴",
      format: "tips",
      hooks: ["谈薪", "底线"],
    },
    {
      title: "入职前夜焦虑，我用前30天计划安放",
      angle: "适应期计划模板",
      format: "emotion",
      hooks: ["前30天", "安放"],
    },
    {
      title: "留下或离开：我的非情绪决策清单",
      angle: "冷静天再决定的规则",
      format: "tips",
      hooks: ["决策", "冷静天"],
    },
    {
      title: "试用期我给自己定的「可退出条件」",
      angle: "不是消极，是安全绳",
      format: "story",
      hooks: ["可退出", "安全绳"],
    },
    {
      title: "offer来了但身体说不：我听谁的",
      angle: "身体信号写入决策",
      format: "emotion",
      hooks: ["身体", "信号"],
    },
    {
      title: "薪资谈不拢时，我问清的三个非现金项",
      angle: "弹性/学习/职责边界",
      format: "tips",
      hooks: ["非现金", "问清"],
    },
  ],
  life: [
    {
      title: "求职之外，我把早饭重新吃上了",
      angle: "用一件小事证明生活没有停摆",
      format: "story",
      hooks: ["小事", "节律"],
    },
    {
      title: "搬家纸箱还没收完，我先恢复了散步",
      angle: "混乱期的最小运动处方",
      format: "story",
      hooks: ["散步", "最小"],
    },
    {
      title: "朋友问近况，我不再只答「还在找工作」",
      angle: "丰满自我介绍：求职+生活各一句",
      format: "emotion",
      hooks: ["近况", "丰满"],
    },
    {
      title: "周末我允许自己不改简历的半天",
      angle: "休息规则，防止耗竭",
      format: "tips",
      hooks: ["半天假", "防耗竭"],
    },
    {
      title: "做饭变成我的情绪稳定器",
      angle: "生活技能如何反哺求职耐心",
      format: "story",
      hooks: ["做饭", "稳定"],
    },
    {
      title: "家庭群里的关心，有时比拒信更难接",
      angle: "边界话术：感谢+进度+请求",
      format: "emotion",
      hooks: ["家庭", "边界话术"],
    },
    {
      title: "把桌面清理干净的那天，投递也顺了一点",
      angle: "环境整理与行动阻力",
      format: "story",
      hooks: ["桌面", "阻力"],
    },
    {
      title: "睡眠债还完之前，我不加更求职内容",
      angle: "身体优先于账号勤奋",
      format: "tips",
      hooks: ["睡眠", "优先"],
    },
    {
      title: "和旧友吃饭：我练习只听不辩解",
      angle: "社交中的人设真实感",
      format: "story",
      hooks: ["旧友", "只听"],
    },
    {
      title: "记账本上的「求职开支」让我更清醒",
      angle: "交通/课程/服装的现实账",
      format: "tips",
      hooks: ["记账", "清醒"],
    },
    {
      title: "阳台植物死而复生，像极了我的状态",
      angle: "轻隐喻，不鸡汤；落到护理动作",
      format: "emotion",
      hooks: ["植物", "动作"],
    },
    {
      title: "通勤路换成步行一段后的意外收获",
      angle: "身体节律如何影响面试当天状态",
      format: "story",
      hooks: ["步行", "状态"],
    },
    {
      title: "房间里留一块「非求职角落」",
      angle: "空间分区保护心理边界",
      format: "tips",
      hooks: ["角落", "边界"],
    },
    {
      title: "月经期那几天，我降低投递目标不降低自尊",
      angle: "身体周期写入求职计划",
      format: "emotion",
      hooks: ["周期", "自尊"],
    },
    {
      title: "学会拒绝「好心内推但不匹配」",
      angle: "人情与匹配的平衡",
      format: "tips",
      hooks: ["内推", "拒绝"],
    },
    {
      title: "一本无关求职的书，救了我某个周三",
      angle: "输入多样性对抗单一焦虑",
      format: "story",
      hooks: ["阅读", "多样性"],
    },
  ],
};

const CAREER_SEEDS: Record<PillarId, TopicSeed[]> = {
  restart: [
    {
      title: "入职满三个月，我终于敢改自己的一句话介绍",
      angle: "用现在时讲清角色，不靠公司名撑场",
      format: "story",
      hooks: ["一句话", "角色"],
    },
    {
      title: "我不写「拥抱变化」，只写这周换了什么方法",
      angle: "反鸡汤：变化落到可观察动作",
      format: "tips",
      hooks: ["方法", "可观察"],
    },
    {
      title: "从执行到owner：我踩过的身份错位",
      angle: "职责边界怎么口头对齐",
      format: "story",
      hooks: ["owner", "对齐"],
    },
    {
      title: "职场人设不是人设照，是一周可复现的节奏",
      angle: "公开你的工作节律模板",
      format: "tips",
      hooks: ["节律", "模板"],
    },
  ],
  "age-edu": [
    {
      title: "年龄不是滤镜：我怎么写「经验密度」",
      angle: "把年限换成案例密度",
      format: "tips",
      hooks: ["经验密度", "案例"],
    },
    {
      title: "被当成「稳重」时，我如何避免被低估",
      angle: "展示判断力而不是只展示听话",
      format: "story",
      hooks: ["判断力", "低估"],
    },
    {
      title: "学历话题出现时，我把焦点拉回交付",
      angle: "三句话把讨论拉回结果",
      format: "tips",
      hooks: ["交付", "拉回"],
    },
  ],
  resume: [
    {
      title: "周报我改成「问题-动作-结果」三行",
      angle: "可被转发的周报结构",
      format: "tips",
      hooks: ["周报", "三行"],
    },
    {
      title: "作品化工作：我把项目写成对外也能看的案例",
      angle: "脱敏案例页模板",
      format: "tips",
      hooks: ["案例页", "脱敏"],
    },
    {
      title: "绩效材料我提前八周开始攒证据",
      angle: "证据包清单，少临时抱佛脚",
      format: "story",
      hooks: ["证据包", "绩效"],
    },
    {
      title: "删掉汇报里的形容词之后，领导反而问得更细",
      angle: "结果导向写作前后对照",
      format: "story",
      hooks: ["结果", "对照"],
    },
  ],
  interview: [
    {
      title: "一对一前，我只准备三个要确认的点",
      angle: "向上沟通的议程模板",
      format: "tips",
      hooks: ["一对一", "议程"],
    },
    {
      title: "跨部门对齐：我怎么开场才不吵架",
      angle: "冲突前置的缓冲句",
      format: "tips",
      hooks: ["跨部门", "缓冲"],
    },
    {
      title: "被当众提问卡壳后，我用的补救三步",
      angle: "现场翻车的可执行挽回",
      format: "emotion",
      hooks: ["翻车", "挽回"],
    },
  ],
  rejection: [
    {
      title: "方案被否：我只复盘流程不复盘人格",
      angle: "否决邮件的拆解框架",
      format: "tips",
      hooks: ["被否", "拆解"],
    },
    {
      title: "晋升没过那年，我给自己的止损规则",
      angle: "情绪出口 + 下一周期动作",
      format: "emotion",
      hooks: ["晋升", "止损"],
    },
    {
      title: "反馈刺耳时，我先写下可改的那一行",
      angle: "把评价翻译成任务",
      format: "story",
      hooks: ["反馈", "任务"],
    },
  ],
  choice: [
    {
      title: "内部转岗我问清的四个非标题问题",
      angle: "团队/节奏/评价/成长路径",
      format: "tips",
      hooks: ["转岗", "四问"],
    },
    {
      title: "加班文化试探：我怎么表达边界不撕破脸",
      angle: "边界话术示例",
      format: "tips",
      hooks: ["边界", "话术"],
    },
    {
      title: "机会来了但身体说不：我的决策清单",
      angle: "非情绪决策日规则",
      format: "emotion",
      hooks: ["身体", "决策"],
    },
  ],
  life: [
    {
      title: "通勤耳机歌单救了我某个周三",
      angle: "用一件小事证明工作之外还有我",
      format: "story",
      hooks: ["通勤", "小事"],
    },
    {
      title: "周末半天「不回工作消息」的实验",
      angle: "休息规则公开化",
      format: "tips",
      hooks: ["半天假", "规则"],
    },
    {
      title: "晚饭自己做的那天，晚上会少刷手机",
      angle: "生活技能反哺专注",
      format: "story",
      hooks: ["做饭", "专注"],
    },
    {
      title: "朋友问近况，我练习不把KPI当全部",
      angle: "丰满自我介绍",
      format: "emotion",
      hooks: ["近况", "丰满"],
    },
  ],
};

const LIFE_SEEDS: Record<PillarId, TopicSeed[]> = {
  restart: [
    {
      title: "我把账号从「展示完美」改成「记录真实」",
      angle: "叙事转向：动机与边界",
      format: "story",
      hooks: ["转向", "真实"],
    },
    {
      title: "开始认真写日常之前，我删掉的三种开头",
      angle: "反鸡汤清单",
      format: "tips",
      hooks: ["开头", "边界"],
    },
  ],
  "age-edu": [
    {
      title: "年龄写进自我介绍时，我不再道歉",
      angle: "用经历密度代替自贬",
      format: "emotion",
      hooks: ["年龄", "不道歉"],
    },
    {
      title: "被问「你还在折腾什么」时的半句答法",
      angle: "诚实但不辩解",
      format: "tips",
      hooks: ["半句", "答法"],
    },
  ],
  resume: [
    {
      title: "把一周做成可翻阅的生活档案",
      angle: "照片/文字/物件三件套",
      format: "tips",
      hooks: ["档案", "三件套"],
    },
    {
      title: "我的素材箱：随手记怎么变成一篇完整笔记",
      angle: "从碎片到成稿的流程",
      format: "tips",
      hooks: ["素材箱", "成稿"],
    },
  ],
  interview: [
    {
      title: "和重要的人吃饭前，我练习只听不急着解释",
      angle: "对话现场的节奏",
      format: "story",
      hooks: ["只听", "节奏"],
    },
    {
      title: "被追问近况时，我用的开场缓冲句",
      angle: "紧张时的可执行开场",
      format: "emotion",
      hooks: ["缓冲", "近况"],
    },
  ],
  rejection: [
    {
      title: "计划泡汤那天，我给自己的情绪出口",
      angle: "允许难过的时段 + 之后的小事",
      format: "emotion",
      hooks: ["泡汤", "出口"],
    },
    {
      title: "社交已读不回：我不再秒回的边界",
      angle: "哪些值得跟进",
      format: "tips",
      hooks: ["已读", "边界"],
    },
  ],
  choice: [
    {
      title: "两件想做的事撞车：我的非情绪选择表",
      angle: "精力/金钱/心情三维",
      format: "tips",
      hooks: ["选择表", "三维"],
    },
    {
      title: "留下或离开一段关系：冷静天再决定",
      angle: "决策规则公开",
      format: "story",
      hooks: ["冷静天", "关系"],
    },
  ],
  life: [
    {
      title: "把早饭重新吃上的那个早晨",
      angle: "一件小事建立节律",
      format: "story",
      hooks: ["早饭", "节律"],
    },
    {
      title: "搬家纸箱还没收完，我先恢复了散步",
      angle: "混乱期的最小运动",
      format: "story",
      hooks: ["散步", "最小"],
    },
    {
      title: "周末允许自己什么都不产出的半天",
      angle: "休息规则防耗竭",
      format: "tips",
      hooks: ["半天", "休息"],
    },
    {
      title: "做饭变成情绪稳定器的一周",
      angle: "生活技能如何安放焦虑",
      format: "story",
      hooks: ["做饭", "稳定"],
    },
    {
      title: "家庭群里的关心，有时比外界更难接",
      angle: "边界话术：感谢+进度+请求",
      format: "emotion",
      hooks: ["家庭", "话术"],
    },
    {
      title: "桌面清理干净的那天，人也清爽一点",
      angle: "环境与行动阻力",
      format: "story",
      hooks: ["桌面", "清爽"],
    },
    {
      title: "睡眠债还完之前，我不加更内容",
      angle: "身体优先于勤奋表演",
      format: "tips",
      hooks: ["睡眠", "优先"],
    },
    {
      title: "阳台植物死而复生，像极了我的状态",
      angle: "轻隐喻落到护理动作",
      format: "emotion",
      hooks: ["植物", "动作"],
    },
    {
      title: "房间里留一块「什么都不做」的角落",
      angle: "空间分区保护边界",
      format: "tips",
      hooks: ["角落", "边界"],
    },
    {
      title: "一本无关效率的书，救了某个周三",
      angle: "输入多样性",
      format: "story",
      hooks: ["阅读", "多样"],
    },
    {
      title: "给自己买花那天，心情比预期正经",
      angle: "小仪式不鸡汤",
      format: "story",
      hooks: ["买花", "仪式"],
    },
    {
      title: "关掉群免打扰之后的安静晚餐",
      angle: "通知边界实验",
      format: "tips",
      hooks: ["免打扰", "晚餐"],
    },
  ],
};

function cloneSeeds(
  seeds: Record<PillarId, TopicSeed[]>,
): Record<PillarId, TopicSeed[]> {
  return {
    restart: seeds.restart.map((t) => ({ ...t, hooks: [...t.hooks] as [string, string] })),
    "age-edu": seeds["age-edu"].map((t) => ({
      ...t,
      hooks: [...t.hooks] as [string, string],
    })),
    resume: seeds.resume.map((t) => ({ ...t, hooks: [...t.hooks] as [string, string] })),
    interview: seeds.interview.map((t) => ({
      ...t,
      hooks: [...t.hooks] as [string, string],
    })),
    rejection: seeds.rejection.map((t) => ({
      ...t,
      hooks: [...t.hooks] as [string, string],
    })),
    choice: seeds.choice.map((t) => ({ ...t, hooks: [...t.hooks] as [string, string] })),
    life: seeds.life.map((t) => ({ ...t, hooks: [...t.hooks] as [string, string] })),
  };
}

export const PERSONA_PRESETS: {
  id: PresetId;
  label: string;
  blurb: string;
  persona: CreatorPersona;
}[] = [
  {
    id: "home",
    label: "家居博主",
    blurb: "收纳改造与松弛家居，前 4 周先认识你再给方法",
    persona: {
      presetId: "home",
      name: "家居博主",
      age: 28,
      gender: "女",
      background: "租房改造 / 小户型",
      stage: "图文起号：用真实家居场景涨粉",
      voice: "具体、好抄、不装精致；前后对比和清单优先。",
      audience: "想把小家过舒服的年轻人",
      trustAnchors: [
        "只写自己动手做过的改造",
        "价格与尺寸说清楚",
        "避雷比安利更真诚",
      ],
      topicSeeds: {
        restart: [],
        "age-edu": [],
        resume: [],
        interview: [],
        rejection: [],
        choice: [],
        life: [],
      },
      phases: LAUNCH_PHASES.map((p) => ({ ...p })),
      noteTags: ["#家居", "#收纳", "#租房改造", "#小户型", "#真实分享"],
      contentMix: "life",
    },
  },
  {
    id: "auto",
    label: "汽车博主",
    blurb: "用车真实体验与避坑，适合新手车主起号",
    persona: {
      presetId: "auto",
      name: "汽车博主",
      age: 30,
      gender: "",
      background: "通勤车主",
      stage: "图文起号：真实用车故事拉新",
      voice: "白话、可验证、少吹嘘；油耗与坑点写清楚。",
      audience: "新手司机与在意养车成本的人",
      trustAnchors: [
        "数据来自自己的车",
        "不写软文口吻",
        "安全提醒放在前面",
      ],
      topicSeeds: {
        restart: [],
        "age-edu": [],
        resume: [],
        interview: [],
        rejection: [],
        choice: [],
        life: [],
      },
      phases: LAUNCH_PHASES.map((p) => ({ ...p })),
      noteTags: ["#汽车", "#用车心得", "#新手司机", "#真实分享"],
      contentMix: "life",
    },
  },
  {
    id: "resign",
    label: "离职博主",
    blurb: "离职重启与求职过程，慢热建立信任再给干货",
    persona: {
      presetId: "resign",
      name: "离职博主",
      age: 37,
      gender: "女",
      background: "双非本科",
      stage: "离职后求职重启：简历 + 真实焦虑",
      voice:
        "真诚、克制煽情、有具体动作与复盘；现在时叙述，不做成功学鸡汤。",
      audience: "30+ 想重启/正在求职、在意年龄与学历标签的人",
      trustAnchors: [...JOB_TRUST],
      topicSeeds: cloneSeeds(JOB_SEEDS),
      phases: JOB_PHASES.map((p) => ({ ...p })),
      noteTags: [
        "#离职",
        "#求职",
        "#离职重启",
        "#真实分享",
        "#职场",
        "#简历",
        "#面试",
      ],
      contentMix: "job",
    },
  },
  {
    id: "career-daily",
    label: "职场日常",
    blurb: "在职真实一周：协作、边界与节律",
    persona: {
      presetId: "career-daily",
      name: "职场日常",
      age: 32,
      gender: "女",
      background: "互联网从业",
      stage: "在职深耕：能力、协作与长期节奏",
      voice: "具体、可复盘、少鸡汤；用一周真实动作说话。",
      audience: "想把工作做明白、又不愿表演奋斗的职场人",
      trustAnchors: [...CAREER_TRUST],
      topicSeeds: cloneSeeds(CAREER_SEEDS),
      phases: CAREER_PHASES.map((p) => ({ ...p })),
      noteTags: ["#职场日常", "#工作方法", "#真实分享", "#生活与工作"],
      contentMix: "career",
    },
  },
  {
    id: "life-journal",
    label: "生活记录",
    blurb: "日常切片起号，用真实日子拉近距离",
    persona: {
      presetId: "life-journal",
      name: "生活记录",
      age: 30,
      gender: "女",
      background: "城市生活",
      stage: "图文起号：认真过日常",
      voice: "轻、具体、不装精致；情绪可以有，结尾落到动作。",
      audience: "想把日子过明白、喜欢真实日常的人",
      trustAnchors: [...LIFE_TRUST],
      topicSeeds: cloneSeeds(LIFE_SEEDS),
      phases: LAUNCH_PHASES.map((p) => ({ ...p })),
      noteTags: ["#生活记录", "#日常", "#真实分享", "#慢慢生活"],
      contentMix: "life",
    },
  },
  {
    id: "custom",
    label: "自定义",
    blurb: "从空白人设起步，自行填写后重算",
    persona: {
      presetId: "custom",
      name: "我的创作者人设",
      age: 30,
      gender: "",
      background: "",
      stage: "请描述你当前阶段",
      voice: "真诚、具体、少鸡汤",
      audience: "请描述你的目标读者",
      trustAnchors: ["我只写这一周真实发生的动作", "不卖鸡汤，只给可验证细节"],
      topicSeeds: {
        restart: [],
        "age-edu": [],
        resume: [],
        interview: [],
        rejection: [],
        choice: [],
        life: [],
      },
      phases: LAUNCH_PHASES.map((p) => ({ ...p })),
      noteTags: ["#真实分享", "#创作日常"],
      contentMix: "life",
    },
  },
];

/** 起号方向（不含自定义），用于首页引导。 */
export const LAUNCH_PRESETS = PERSONA_PRESETS.filter((p) => p.id !== "custom");

export const DEFAULT_PERSONA: CreatorPersona = clonePersona(
  PERSONA_PRESETS.find((p) => p.id === "life-journal")!.persona,
);

/** @deprecated Prefer DEFAULT_PERSONA / state.persona */
export const PERSONA = DEFAULT_PERSONA;

export function clonePersona(persona: CreatorPersona): CreatorPersona {
  return {
    ...persona,
    trustAnchors: [...persona.trustAnchors],
    noteTags: [...persona.noteTags],
    phases: persona.phases.map((p) => ({ ...p })),
    topicSeeds: cloneSeeds(persona.topicSeeds),
  };
}

export function getPreset(id: PresetId): CreatorPersona {
  const normalized = normalizePresetId(id);
  const found = PERSONA_PRESETS.find((p) => p.id === normalized)?.persona;
  return clonePersona(
    found ?? PERSONA_PRESETS.find((p) => p.id === "life-journal")!.persona,
  );
}

export function personaIdentityLine(persona: CreatorPersona): string {
  const bits = [
    persona.age ? `${persona.age}岁` : null,
    persona.background || null,
    persona.stage || null,
  ].filter(Boolean);
  return bits.join("，");
}

export function personaHookTag(persona: CreatorPersona): string {
  const age = persona.age ? `${persona.age}岁` : "创作者";
  const bg = persona.background || persona.name;
  return `${age}·${bg}`;
}

export function normalizePersona(
  raw: Partial<CreatorPersona> | null | undefined,
): CreatorPersona {
  const base = clonePersona(DEFAULT_PERSONA);
  if (!raw || typeof raw !== "object") return base;
  const presetId = normalizePresetId(
    (raw.presetId as PresetId) || base.presetId,
  );
  const fromPreset =
    PERSONA_PRESETS.find((p) => p.id === presetId)?.persona ?? base;
  return {
    ...clonePersona(fromPreset),
    ...raw,
    presetId,
    trustAnchors:
      Array.isArray(raw.trustAnchors) && raw.trustAnchors.length
        ? raw.trustAnchors.map(String)
        : fromPreset.trustAnchors,
    noteTags:
      Array.isArray(raw.noteTags) && raw.noteTags.length
        ? raw.noteTags.map(String)
        : fromPreset.noteTags,
    phases:
      Array.isArray(raw.phases) && raw.phases.length
        ? raw.phases
        : fromPreset.phases,
    topicSeeds:
      raw.topicSeeds && Object.keys(raw.topicSeeds).length
        ? {
            ...cloneSeeds(fromPreset.topicSeeds),
            ...Object.fromEntries(
              (Object.keys(raw.topicSeeds) as PillarId[]).map((k) => [
                k,
                Array.isArray(raw.topicSeeds?.[k])
                  ? raw.topicSeeds![k]!
                  : fromPreset.topicSeeds[k],
              ]),
            ),
          }
        : cloneSeeds(fromPreset.topicSeeds),
    age: Number(raw.age ?? fromPreset.age) || fromPreset.age,
    name: String(raw.name ?? fromPreset.name),
    gender: String(raw.gender ?? fromPreset.gender ?? ""),
    background: String(
      raw.background ??
        (raw as { education?: string }).education ??
        fromPreset.background,
    ),
    stage: String(raw.stage ?? fromPreset.stage),
    voice: String(raw.voice ?? fromPreset.voice),
    audience: String(raw.audience ?? fromPreset.audience),
    contentMix: (raw.contentMix as ContentMix) || fromPreset.contentMix,
  };
}

export function editableFieldsFromPersona(persona: CreatorPersona): {
  name: string;
  age: number;
  gender: string;
  background: string;
  stage: string;
  voice: string;
  audience: string;
  trustAnchorsText: string;
  noteTagsText: string;
} {
  return {
    name: persona.name,
    age: persona.age,
    gender: persona.gender,
    background: persona.background,
    stage: persona.stage,
    voice: persona.voice,
    audience: persona.audience,
    trustAnchorsText: persona.trustAnchors.join("\n"),
    noteTagsText: persona.noteTags.join(" "),
  };
}

export function applyEditableFields(
  persona: CreatorPersona,
  fields: {
    name: string;
    age: number;
    gender: string;
    background: string;
    stage: string;
    voice: string;
    audience: string;
    trustAnchorsText: string;
    noteTagsText: string;
  },
): CreatorPersona {
  const trustAnchors = fields.trustAnchorsText
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const noteTags = fields.noteTagsText
    .split(/[\s,，]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t}`));
  const next: CreatorPersona = {
    ...clonePersona(persona),
    name: fields.name.trim() || persona.name,
    age: Number(fields.age) || persona.age,
    gender: fields.gender.trim(),
    background: fields.background.trim(),
    stage: fields.stage.trim(),
    voice: fields.voice.trim(),
    audience: fields.audience.trim(),
    trustAnchors: trustAnchors.length ? trustAnchors : persona.trustAnchors,
    noteTags: noteTags.length ? noteTags : persona.noteTags,
    presetId: persona.presetId === "custom" ? "custom" : persona.presetId,
  };
  return ensurePersonaTopicSeeds(next);
}

/** True when every pillar seed list is empty. */
export function topicSeedsAreEmpty(
  seeds: Record<PillarId, TopicSeed[]>,
): boolean {
  return (Object.keys(seeds) as PillarId[]).every(
    (k) => !seeds[k] || seeds[k].length === 0,
  );
}

const HOME_NOMINALS = [
  "出租屋第一次改造",
  "周末收纳断舍离",
  "灯光换了心情也换了",
  "小户型动线复盘",
  "便宜好用的收纳神器",
  "沙发区这样摆更松弛",
  "厨房台面清空术",
  "阳台变成小小绿意角",
  "租房也能有仪式感",
  "对照片友好的角落",
  "一平米改造前后",
  "客卧变书房的周末",
  "软装配色避雷",
  "搬家三天清单",
  "夜灯氛围感练习",
  "桌面极简但好用",
];

const AUTO_NOMINALS = [
  "新手第一次上路紧张点",
  "保养别被忽悠的三句话",
  "周末洗车我只做这些",
  "通勤油耗真实账",
  "停车位选择血泪史",
  "车上常备急救包清单",
  "雨天开车我改掉的习惯",
  "试驾十分钟看什么",
  "车内收纳不杂乱",
  "长途前夜检查单",
  "配件只买必要的",
  "第一次独自高速",
  "爱车小伤怎么处理",
  "加油优惠我怎么比",
  "夜间开车护眼习惯",
  "和家人共用一辆车的边界",
];

const DOMAIN_PACKS: { test: RegExp; label: string; nominals: string[] }[] = [
  {
    test: /家居|收纳|软装|装修|租房改造|小户型|桌面|动线/,
    label: "家居",
    nominals: HOME_NOMINALS,
  },
  {
    test: /汽车|车主|开车|试驾|油耗|保养|停车|车内/,
    label: "汽车",
    nominals: AUTO_NOMINALS,
  },
  {
    test: /美食|做饭|探店|下厨|烘焙|菜谱|吃货|料理|食堂|宵夜|家常菜/,
    label: "美食",
    nominals: [
      "家常晚饭",
      "菜市场砍价",
      "一人食餐桌",
      "探店踩雷复盘",
      "试新锅具",
      "半小时备菜",
      "剩菜改造",
      "早餐重新开工",
      "外卖对比自制",
      "朋友来家里吃",
      "深夜清冰箱",
      "学会一道拿手菜",
      "便当出差一天",
      "火候失误的那天",
      "菜场时令清单",
      "减糖不减味",
      "厨房动线改造",
      "分享一碗汤的理由",
    ],
  },
  {
    test: /穿搭|服饰|衣橱|搭配|逛街|买手/,
    label: "穿搭",
    nominals: [
      "衣橱断舍离",
      "一套通勤公式",
      "旧衣重搭",
      "鞋履护理",
      "胶囊衣橱",
      "显贵不显贵",
      "季节换装",
      "镜子前三分钟",
    ],
  },
  {
    test: /母婴|育儿|带娃|宝妈|宝爸/,
    label: "育儿",
    nominals: [
      "午睡窗口",
      "辅食第一次",
      "带娃出门清单",
      "情绪共情练习",
      "大人也要休息",
      "玩具断舍离",
    ],
  },
  {
    test: /健身|跑步|运动|减肥|训练/,
    label: "运动",
    nominals: [
      "晨跑打卡",
      "力量训练周记",
      "拉伸十分钟",
      "运动后饮食",
      "停滞期复盘",
      "装备只买必要的",
    ],
  },
];

const GENERIC_CREATOR_NOMINALS = [
  "一次真实失败",
  "本周小仪式",
  "读者常问的问题",
  "灵感从何而来",
  "一小时深度工作",
  "评论区里学到的",
];

export function personaDomainText(persona: CreatorPersona): string {
  return [
    persona.name,
    persona.background,
    persona.stage,
    persona.audience,
    persona.voice,
    ...persona.noteTags,
    ...persona.trustAnchors,
  ].join(" ");
}

export function domainNominalsForPersona(persona: CreatorPersona): string[] {
  const text = personaDomainText(persona);
  if (
    persona.contentMix === "job" ||
    /求职|离职|重启|面试|简历|双非|找工作|大龄求职|空白期/.test(text)
  ) {
    return [
      "简历删改",
      "投递节奏",
      "自我介绍",
      "学历答法",
      "拒信复盘",
      "试岗观察",
      "生活节律",
      "面试故事库",
    ];
  }
  if (
    persona.contentMix === "career" ||
    /职场成长|晋升|协作|在职|向上管理/.test(text)
  ) {
    return [
      "周复盘",
      "会议要结论",
      "反馈拆解",
      "边界感",
      "可验证贡献",
      "生活节律",
    ];
  }
  for (const pack of DOMAIN_PACKS) {
    if (pack.test.test(text)) return pack.nominals;
  }
  return LIFE_SEEDS.life.map((t) => t.title).concat(GENERIC_CREATOR_NOMINALS);
}

function seedFromNominal(
  nominal: string,
  format: TopicSeed["format"],
  anglePrefix: string,
): TopicSeed {
  return {
    title: nominal,
    angle: `${anglePrefix}「${nominal}」`,
    format,
    hooks: [nominal.slice(0, 8), "真实"],
  };
}

function seedsFromNominals(
  nominals: string[],
  personaName: string,
): Record<PillarId, TopicSeed[]> {
  const life = nominals.map((n, i) =>
    seedFromNominal(n, i % 3 === 0 ? "tips" : "story", "用具体场景写出"),
  );
  const restart = nominals.slice(0, 8).map((n, i) =>
    seedFromNominal(
      `${personaName.replace(/博主|创作者/g, "").trim() || "创作者"}的开场：${n}`,
      i % 2 === 0 ? "story" : "emotion",
      "讲清你是谁，用",
    ),
  );
  const choice = nominals.slice(2, 12).map((n, i) =>
    seedFromNominal(
      `关于「${n}」我做的取舍`,
      i % 2 === 0 ? "tips" : "story",
      "不讲空泛成功学，围绕",
    ),
  );
  const soft = nominals.slice(4, 14).map((n) =>
    seedFromNominal(`复盘：${n}`, "emotion", "诚实写下"),
  );
  return {
    life,
    restart,
    choice,
    "age-edu": soft.slice(0, 4),
    resume: soft.slice(2, 6),
    interview: soft.slice(1, 5),
    rejection: soft.slice(3, 7),
  };
}

export type BuiltPersonaSeeds = {
  topicSeeds: Record<PillarId, TopicSeed[]>;
  contentMix: ContentMix;
  phases: PhaseDef[];
};

/**
 * Build calendar seeds for a custom persona from name/stage/tags.
 * Job / career keywords restore curated banks — never generic "做内容" topics.
 */
export function buildTopicSeedsFromPersona(
  persona: CreatorPersona,
): BuiltPersonaSeeds {
  const text = personaDomainText(persona);

  if (
    persona.contentMix === "job" ||
    /求职|离职|重启人生|重启求职|面试|简历|双非|找工作|大龄求职|空白期/.test(
      text,
    )
  ) {
    return {
      topicSeeds: cloneSeeds(JOB_SEEDS),
      contentMix: "job",
      phases: JOB_PHASES.map((p) => ({ ...p })),
    };
  }

  if (
    persona.contentMix === "career" ||
    /职场成长|晋升|协作|在职深耕|向上管理/.test(text)
  ) {
    return {
      topicSeeds: cloneSeeds(CAREER_SEEDS),
      contentMix: "career",
      phases: CAREER_PHASES.map((p) => ({ ...p })),
    };
  }

  for (const pack of DOMAIN_PACKS) {
    if (pack.test.test(text)) {
      return {
        topicSeeds: seedsFromNominals(pack.nominals, persona.name),
        contentMix: "life",
        phases: LIFE_PHASES.map((p) => ({ ...p })),
      };
    }
  }

  // Default custom / life: real life-journal seeds, not meta "做内容" filler
  return {
    topicSeeds: cloneSeeds(LIFE_SEEDS),
    contentMix: "life",
    phases: LIFE_PHASES.map((p) => ({ ...p })),
  };
}

/**
 * Guarantee topic seeds match the persona type.
 * System presets always use curated banks; custom uses domain detection.
 */
export function ensurePersonaTopicSeeds(
  persona: CreatorPersona,
): CreatorPersona {
  const p = clonePersona(persona);
  const presetId = normalizePresetId(p.presetId);
  p.presetId = presetId;

  if (presetId === "home") {
    return {
      ...p,
      topicSeeds: seedsFromNominals(HOME_NOMINALS, p.name),
      contentMix: "life",
      phases: LAUNCH_PHASES.map((x) => ({ ...x })),
    };
  }
  if (presetId === "auto") {
    return {
      ...p,
      topicSeeds: seedsFromNominals(AUTO_NOMINALS, p.name),
      contentMix: "life",
      phases: LAUNCH_PHASES.map((x) => ({ ...x })),
    };
  }
  if (
    presetId === "resign" ||
    presetId === "career-daily" ||
    presetId === "life-journal"
  ) {
    const fromPreset =
      PERSONA_PRESETS.find((x) => x.id === presetId)?.persona ?? p;
    return {
      ...p,
      topicSeeds: cloneSeeds(fromPreset.topicSeeds),
      contentMix: fromPreset.contentMix,
      phases: fromPreset.phases.map((x) => ({ ...x })),
    };
  }

  // custom
  const built = buildTopicSeedsFromPersona(p);
  return {
    ...p,
    presetId: "custom",
    topicSeeds: built.topicSeeds,
    contentMix: built.contentMix,
    phases: built.phases,
  };
}

export function pillarLabel(id: PillarId): string {
  return PILLARS.find((p) => p.id === id)?.label ?? id;
}

export function phaseLabel(id: PhaseId, persona?: CreatorPersona): string {
  const phases = persona?.phases ?? PHASES;
  return phases.find((p) => p.id === id)?.label ?? `阶段${id}`;
}

export function phaseForWeek(week: number, persona?: CreatorPersona): PhaseId {
  const phases = persona?.phases ?? PHASES;
  for (const p of phases) {
    if (week >= p.weekFrom && week <= p.weekTo) return p.id;
  }
  if (week <= 4) return 1;
  if (week <= 20) return 2;
  if (week <= 36) return 3;
  return 4;
}

/**
 * Month 1 (weeks 1–4): 1 post/week.
 * Month 2+ (week 5+): ramp to 2/week (not 3–4).
 */
export function defaultPostsPerWeek(week: number): number {
  if (week <= 4) return 1;
  if (week <= 8) return 2;
  return 2;
}

export function defaultPillarForPersona(persona: CreatorPersona): PillarId {
  if (persona.contentMix === "life") return "life";
  if (persona.contentMix === "career") return "resume";
  return "resume";
}
