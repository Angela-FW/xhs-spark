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

type TopicSpec = {
  title: string;
  angle: string;
  format: CalendarPost["format"];
  hooks: [string, string];
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

/** Unique topics — consumed once per calendar build (no title reuse). */
const TOPICS: Record<PillarId, TopicSpec[]> = {
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

function takeTopic(
  pillar: PillarId,
  used: Set<string>,
  cursor: Record<PillarId, number>,
  week: number,
  indexInWeek: number,
): TopicSpec {
  const list = TOPICS[pillar];
  let guard = 0;
  while (guard < list.length * 2) {
    const idx = cursor[pillar] % list.length;
    cursor[pillar] += 1;
    const topic = list[idx];
    if (!used.has(topic.title)) {
      used.add(topic.title);
      return topic;
    }
    guard += 1;
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
): TopicSpec {
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
        ? `用「${nominal}」这一件具体事丰满人物形象，轻连求职但不抢戏`
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
): PillarId {
  // Month 1: one trust-focused piece per week, rotating restart / age-edu / light life
  if (phase === 1) {
    const seq: PillarId[] = ["restart", "age-edu", "life", "restart"];
    return seq[(week - 1) % seq.length];
  }

  // From month 2: job content + life interleaved (~1/3 life)
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

  // phase 4
  if (indexInWeek === 1 || (postsPerWeek === 1 && week % 3 === 0)) return "life";
  const wrap: PillarId[] = ["restart", "choice", "age-edu", "choice"];
  return wrap[(week + indexInWeek) % wrap.length];
}

export function buildYearCalendar(
  startDate: string = CALENDAR_START,
): YearCalendar {
  const weekStart0 = mondayOnOrBefore(startDate);
  const weeks: WeekPlan[] = [];
  const posts: CalendarPost[] = [];
  const usedTitles = new Set<string>();
  const cursor = Object.fromEntries(
    (Object.keys(TOPICS) as PillarId[]).map((k) => [k, 0]),
  ) as Record<PillarId, number>;

  for (let week = 1; week <= 52; week++) {
    const weekStart = addDays(weekStart0, (week - 1) * 7);
    const phase = phaseForWeek(week);
    const postsPerWeek = defaultPostsPerWeek(week);
    const weekPosts: CalendarPost[] = [];

    for (let i = 0; i < postsPerWeek; i++) {
      const pillar = pillarForSlot(phase, week, i, postsPerWeek);
      const topic = takeTopic(pillar, usedTitles, cursor, week, i);
      const trustAnchor =
        pillar === "life" || (phase === 1 && topic.format === "story")
          ? undefined
          : TRUST_ANCHORS[(week + i) % TRUST_ANCHORS.length];

      const post: CalendarPost = {
        id: `w${week}-p${i + 1}`,
        week,
        weekStart,
        indexInWeek: i,
        phase,
        pillar,
        titleHint: topic.title,
        angle: topic.angle,
        hooks: [...topic.hooks, `${PERSONA.age}岁·${PERSONA.education}`],
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

  // Safety: ensure uniqueness
  const titles = posts.map((p) => p.titleHint);
  if (new Set(titles).size !== titles.length) {
    console.warn("calendar title collision detected");
  }

  return { startDate, weeks, posts };
}
