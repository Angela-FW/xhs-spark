export type CopyStyle =
  | "planting"
  | "pitfall"
  | "tips"
  | "review"
  | "story"
  | "compare";

export type CopyTone = "girl-next-door" | "expert" | "humor" | "luxury" | "sincere";

export interface CopyInput {
  topic: string;
  audience: string;
  sellingPoints: string;
  style: CopyStyle;
  tone: CopyTone;
  keywords: string;
}

export interface GeneratedCopy {
  id: string;
  styleLabel: string;
  titles: string[];
  body: string;
  tags: string[];
  coverIdeas: string[];
  tips: string[];
}

export const STYLE_OPTIONS: { value: CopyStyle; label: string; hint: string }[] =
  [
    { value: "planting", label: "种草安利", hint: "情绪种草，软性推荐" },
    { value: "pitfall", label: "避坑指南", hint: "痛点共鸣，建立信任" },
    { value: "tips", label: "干货分享", hint: "清单结构，收藏向" },
    { value: "review", label: "真实测评", hint: "对比体验，真实感强" },
    { value: "story", label: "故事种草", hint: "叙事开头，沉浸感强" },
    { value: "compare", label: "前后对比", hint: "变化反差，转化率高" },
  ];

export const TONE_OPTIONS: { value: CopyTone; label: string }[] = [
  { value: "girl-next-door", label: "姐妹闺蜜感" },
  { value: "expert", label: "专业可信" },
  { value: "humor", label: "轻松吐槽" },
  { value: "luxury", label: "精致质感" },
  { value: "sincere", label: "真诚口吻" },
];

function splitPoints(raw: string): string[] {
  return raw
    .split(/[,，、\n;/；|]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function splitKeywords(raw: string, topic: string): string[] {
  const fromInput = raw
    .split(/[,，、\n;/；#＃\s]+/)
    .map((s) => s.trim().replace(/^#/, ""))
    .filter(Boolean);
  const defaults = [topic, "种草", "好物推荐", "真实分享", "姐妹必看"];
  return Array.from(new Set([...fromInput, ...defaults])).slice(0, 10);
}

function pick<T>(arr: T[], index: number): T {
  return arr[index % arr.length];
}

function toneOpeners(tone: CopyTone, topic: string, audience: string): string[] {
  const who = audience || "姐妹们";
  switch (tone) {
    case "girl-next-door":
      return [
        `姐妹们！！关于「${topic}」我真的憋不住了`,
        `终于轮到我来安利「${topic}」了…`,
        `${who}集合！这篇我拍大腿后悔没早点写`,
      ];
    case "expert":
      return [
        `把「${topic}」研究透之后，我整理了这份实测结论`,
        `做了对比、踩过坑，才敢认真推荐「${topic}」`,
        `给认真挑选的${who}：关于「${topic}」的干货版`,
      ];
    case "humor":
      return [
        `我为「${topic}」差点变成显眼包，但真香了`,
        `谁懂啊…「${topic}」把我拿捏得死死的`,
        `本社恐居然主动来安利「${topic}」，说明有多香`,
      ];
    case "luxury":
      return [
        `关于「${topic}」，我想认真说一次质感这件事`,
        `不是跟风，是「${topic}」本身足够有说服力`,
        `给在意细节的${who}：一份「${topic}」的精致体验笔记`,
      ];
    case "sincere":
      return [
        `实话实说，我用「${topic}」一段时间后的真实感受`,
        `不夸张、不滤镜：这篇只写「${topic}」的真实体验`,
        `写给正在纠结的${who}——「${topic}」到底值不值得`,
      ];
  }
}

function styleTitles(
  style: CopyStyle,
  topic: string,
  points: string[],
): string[] {
  const p1 = points[0] ?? "真的好用";
  const p2 = points[1] ?? "闭眼入";
  switch (style) {
    case "planting":
      return [
        `${topic}｜被问爆的那款，我终于懂了`,
        `谁还没试过${topic}？晚了真的亏！`,
        `${topic}太会了…${p1}到想回购`,
        `不夸张，${topic}直接拿捏我审美`,
        `小预算大满足｜${topic}真的香到哭`,
      ];
    case "pitfall":
      return [
        `${topic}避坑！这3点不看容易踩雷`,
        `别再乱买${topic}了，看完这篇再下单`,
        `血泪教训｜${topic}我踩过的坑全说清`,
        `${topic}怎么选？避雷版真心话`,
        `买${topic}前必看｜少走弯路清单`,
      ];
    case "tips":
      return [
        `${topic}保姆级攻略｜收藏这一篇就够`,
        `干货｜${topic}从入门到精通的5步`,
        `${topic}这样做，效果翻倍！`,
        `清单党狂喜｜${topic}实用技巧合集`,
        `${topic}省钱又高效的正确打开方式`,
      ];
    case "review":
      return [
        `${topic}真实测评｜值不值？说人话`,
        `用了两周｜${topic}优缺点都在这了`,
        `${topic}深度体验：惊喜点&槽点一次说完`,
        `不是广告｜${topic}实测记录`,
        `${topic}测评结论：适合谁、不适合谁`,
      ];
    case "story":
      return [
        `从怀疑到上头｜我与${topic}的故事`,
        `那晚我差点错过${topic}…`,
        `因为${topic}，我开始被夸「状态变好了」`,
        `一个关于${topic}的小确幸瞬间`,
        `${topic}把我从「随便过」拉回「认真过」`,
      ];
    case "compare":
      return [
        `用${topic}前后差太多了吧？！`,
        `${topic}一周对比｜变化我自己都惊了`,
        `之前随便弄 vs 现在用${topic}`,
        `${topic}对比实测：${p1}真的有感`,
        `别说我夸张｜${topic}前后判若两人`,
      ];
  }
}

function buildBody(input: CopyInput, points: string[]): string {
  const { topic, audience, style, tone } = input;
  const who = audience || "姐妹们";
  const opener = pick(toneOpeners(tone, topic, who), 0);
  const p = points.length
    ? points
    : ["上手简单", "体感明显", "性价比在线", "细节很加分"];

  const bullets = p.map((point, i) => `${i + 1}. ${point} —— 这一点真的很加分`).join("\n");

  const styleBlocks: Record<CopyStyle, string> = {
    planting: `先说结论：如果你也在关注「${topic}」，这篇可以直接收藏。

${opener}

我之前也纠结很久，直到亲测之后才发现——它不是“看起来好看”，而是真的能打。

重点感受：
${bullets}

适合谁：
- ${who}
- 想少踩坑、快速做决定的人
- 喜欢真实分享多于硬广的人

最后一句掏心窝：不是让你冲动下单，而是希望你少走弯路。如果你正在找「${topic}」，这篇或许能帮到你～

有问题评论区聊，看到都会回！❤️`,

    pitfall: `${opener}

很多人一上来就买最贵/最火的，结果踩坑。关于「${topic}」，这几条请先看：

常见误区：
1. 只看热度不看自身需求
2. 被包装和滤镜带跑
3. 忽略使用场景和适配人群

我的避坑建议：
${bullets}

选购口诀：需求明确 > 真实口碑 > 价格冲动。

写给${who}：别被「人人都在用」绑架。适合自己的，才是爆款。

收藏这篇，买前对照一遍，能省不少冤枉钱。`,

    tips: `${opener}

把「${topic}」做成可执行清单，直接抄作业：

步骤/要点：
${bullets}

进阶小技巧：
- 先明确你的目标场景，再选对应方案
- 一次只改一个变量，效果更好观察
- 坚持记录前后变化，比凭感觉更准

给${who}的提醒：干货不是背下来，是用起来。

收藏 + 实践，比反复种草有用一万倍。`,

    review: `${opener}

测评维度我按「真实好用」来写，不美化：

体验拆解：
${bullets}

优点：体感清楚、表达直观、值得反复用。
槽点：还是要看个人肤质/场景/预算匹配度（没有万能答案）。

结论：
- 适合：认真挑选、在意体验的${who}
- 慎重：只想跟风、没有明确需求的人

「${topic}」对我来说是加分项。你的使用场景不同，欢迎评论区互换测评。`,

    story: `${opener}

故事是这样的——

那段时间我一直在卡「${topic}」这件事，试过、放弃过、又捡起来。直到有一次很普通的日常，我突然意识到：原来状态可以被一点点养回来。

后来我坚持下来，变化最明显的是：
${bullets}

不是鸡血，是很生活的那种开心：镜里的自己、身边的反馈、做事的节奏，都轻了一点。

如果${who}也正处于「想改变但不知道从哪开始」，希望「${topic}」能成为你的一个小入口。

愿你也被好好对待。✨`,

    compare: `${opener}

先放对比结论：用「${topic}」之后，差别肉眼可见。

之前：
- 凭感觉瞎忙
- 效果不稳定
- 容易焦虑又放弃

现在：
${bullets}

最让我惊喜的不是“立竿见影”，而是稳定、可持续、愿意坚持。

给还在观望的${who}：对比不是为了制造焦虑，是为了让选择更清楚。

如果你也想看看自己的前后变化，评论区报到，我把记录方法发你～`,
  };

  return styleBlocks[style];
}

function coverIdeas(topic: string, style: CopyStyle): string[] {
  const base = [
    `大字标题「${topic}」+ 真实使用场景特写`,
    `前后对比拼图（左旧右新）+ 一句结论`,
    `手写便签风封面：三个关键词竖排`,
  ];
  if (style === "pitfall") {
    return [
      `红字「避坑」+ 打叉的错误示范缩略图`,
      ...base.slice(0, 2),
    ];
  }
  if (style === "tips") {
    return [
      `清单封面：1/2/3 步骤可视化`,
      `「收藏这一篇」手写标注 + 产品平铺`,
      base[0],
    ];
  }
  return base;
}

function publishTips(style: CopyStyle): string[] {
  return [
    "标题前 12 个字决定点击率，把最强钩子放最前",
    "正文前 3 行要有情绪或结果，别先堆产品参数",
    "配图至少 4 张：封面大字 + 细节 + 场景 + 总结图",
    style === "tips"
      ? "干货贴结尾加「保存清单」，提升收藏"
      : "结尾抛互动问题，提高评论与推荐权重",
    "话题标签 8–10 个：大词 + 长尾词组合更稳",
  ];
}

export function generateCopy(input: CopyInput): GeneratedCopy {
  const topic = input.topic.trim() || "这个好物";
  const points = splitPoints(input.sellingPoints);
  const tags = splitKeywords(input.keywords, topic).map((t) => `#${t}`);
  const styleLabel =
    STYLE_OPTIONS.find((s) => s.value === input.style)?.label ?? "种草安利";

  return {
    id: `${Date.now()}`,
    styleLabel,
    titles: styleTitles(input.style, topic, points),
    body: buildBody({ ...input, topic }, points),
    tags,
    coverIdeas: coverIdeas(topic, input.style),
    tips: publishTips(input.style),
  };
}

export function formatFullPost(copy: GeneratedCopy, titleIndex = 0): string {
  const title = copy.titles[titleIndex] ?? copy.titles[0];
  return `${title}\n\n${copy.body}\n\n${copy.tags.join(" ")}`;
}
