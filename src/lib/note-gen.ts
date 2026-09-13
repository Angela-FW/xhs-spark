import {
  pillarLabel,
  personaIdentityLine,
  type CreatorPersona,
} from "./persona";
import type { CalendarPost } from "./year-calendar";

export type GeneratedNote = {
  titles: string[];
  body: string;
  tags: string[];
  coverIdeas: string[];
  coverPrompt: string;
};

const TITLE_OPENERS = [
  "别急着自我否定",
  "我这周终于想明白",
  "不是鸡汤，是实操",
  "我把复杂问题拆小了",
  "给正在路上的你",
  "我才敢说的真话",
  "没人教我这步",
];

const TITLE_ENDINGS = [
  "先把这一步做完",
  "比盲干有效很多",
  "情绪稳住后就有解",
  "这一条真的能落地",
  "今天就能开始做",
  "比鸡汤管用",
  "我亲自踩过坑",
];

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 131 + input.charCodeAt(i)) >>> 0;
  return h;
}

function pick<T>(list: T[], offset: number): T {
  const n = list.length;
  const i = ((offset % n) + n) % n;
  return list[i];
}

export function generateTitleCandidates(
  post: CalendarPost,
  persona: CreatorPersona,
  seed = 0,
  selectedTitle?: string,
): string[] {
  const baseSeed = hashSeed(`${post.id}:${post.titleHint}:${seed}`);
  const opener = pick(TITLE_OPENERS, baseSeed);
  const opener2 = pick(TITLE_OPENERS, baseSeed >>> 2);
  const ending = pick(TITLE_ENDINGS, baseSeed >>> 3);
  const ending2 = pick(TITLE_ENDINGS, baseSeed >>> 5);
  const hook0 = pick(post.hooks.length ? post.hooks : ["真实记录"], baseSeed >>> 1);
  const hook1 = pick(
    post.hooks.length > 1 ? post.hooks : ["可以落地"],
    baseSeed >>> 4,
  );
  const formatWord =
    post.format === "tips" ? "干货" : post.format === "emotion" ? "真心话" : "记录";
  const core = post.titleHint.replace(/^.*?｜/, "").slice(0, 18);
  const ageBg = [persona.age ? `${persona.age}岁` : null, persona.background || null]
    .filter(Boolean)
    .join("");
  const audienceHint =
    persona.contentMix === "life"
      ? "写给同样认真过日常的人"
      : persona.contentMix === "career"
        ? "写给同样在职场里找节奏的人"
        : "写给同样在找工作的人";
  const angleBit = (post.angle ?? "").slice(0, 16);
  const fallbackTitles = [
    `${opener}｜${core || post.titleHint}`,
    `${pillarLabel(post.pillar)}｜${hook0}`,
    ageBg
      ? `${ageBg}｜${opener2.slice(0, 8)}${angleBit ? `·${angleBit}` : ""}`
      : `${persona.name}｜${opener2}·${angleBit}`,
    `${formatWord}｜${hook1}·${ending}`,
    `${audienceHint}｜${ending2}`,
  ];

  // Deduplicate while preserving order; regenerate path should not pin.
  const unique = fallbackTitles.filter(
    (t, i, arr) => t.trim() && arr.indexOf(t) === i,
  );

  const pinned = selectedTitle?.trim();
  if (!pinned) return unique.slice(0, 5);
  return [pinned, ...unique.filter((t) => t !== pinned)].slice(0, 5);
}

function materialBits(post: CalendarPost, extraNote: string): string[] {
  const fromMats = post.materials.map((m) => m.polished).filter(Boolean);
  const lines: string[] = [];
  if (extraNote.trim()) lines.push(extraNote.trim().replace(/\s+/g, " "));
  for (const m of fromMats.slice(0, 3)) {
    lines.push(m.replace(/\s+/g, " ").trim());
  }
  return lines;
}

function cleanTitle(input: string): string {
  return input
    .replace(/^.*?｜/, "")
    .replace(/[「」【】]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function endSentence(text: string): string {
  const t = text.trim();
  if (!t) return t;
  return /[。！？…]$/.test(t) ? t : `${t}。`;
}

function stripPeriod(text: string): string {
  return text.replace(/[。！？…]+$/, "").trim();
}

/** Turn planner jargon into speakable Xiaohongshu lines. */
function humanAngle(angle: string): string {
  let text = angle.trim();
  text = text
    .replace(/^现在时开场[：:]*/, "")
    .replace(/^用极具体的一天动作[，,]*/, "")
    .replace(/^把「?([^」]+)」?拆成.*/, "先把「$1」拆小一点来做")
    .replace(/只用一段回看离职动机/, "先用一段话把离职原因说清楚")
    .replace(/代替空泛重启宣言/, "少喊口号，多写当天真实动作")
    .replace(/对外介绍怎么说，才不像在辩解/, "对外介绍时，少辩解，多讲事实")
    .replace(/用「停止清单」建立边界感/, "先列一份停止清单，守住边界")
    .replace(/事实层\/能力层\/匹配层，避免情绪辩护/, "先讲事实，再讲能力，最后讲匹配")
    .replace(/用履历密度回答稳定性，不承诺感动/, "用履历密度证明稳定，不靠感动")
    .replace(/删改前后对照（脱敏），只留可验证结果/, "删掉空话，只留能被验证的结果")
    .replace(/用一份JD拆解反推简历条目/, "对着一份JD，反推简历该怎么写")
    .replace(/数量下降、回复质量上升的一周记录/, "少海投，提高回复质量")
    .replace(/休息规则防耗竭/, "给休息定一条规则，免得把自己耗干")
    .replace(/防耗竭/, "别把自己耗干")
    .replace(/建立节律/, "把作息先稳住")
    .replace(/生活节律/, "日常作息")
    .replace(/空泛/, "")
    .trim();
  if (!text) return "先把眼前这一步做清楚";
  return stripPeriod(text);
}

/** Speakable identity — never dump planner stage jargon. */
function humanStage(stage: string): string {
  const s = stage.trim();
  if (!s) return "";
  if (/认真过日常|节律、关系与小选择/.test(s)) {
    return "认真过自己的日常";
  }
  if (/求职|找工作|离职|空白期/.test(s)) {
    return s.replace(/[：:].*$/, "").trim() || "正在找下一步";
  }
  // Drop colon-tail jargon: "xxx：aaa、bbb与ccc" → "xxx"
  if (/[：:]/.test(s)) {
    const head = s.split(/[：:]/)[0].trim();
    if (head && head.length <= 16) return head;
  }
  return s.length > 24 ? `${s.slice(0, 22)}…` : s;
}

function sceneByPillar(post: CalendarPost, seed: number): string {
  const scenes: Record<string, string[]> = {
    restart: [
      "电脑一关，房间忽然安静得过分。",
      "那封邮件发出去之后，我坐了很久。",
      "那天没人通知我「你要开始新生活了」。",
    ],
    "age-edu": [
      "简历上那两个字，我又看了两遍。",
      "被追问背景的时候，我停了半秒。",
      "年龄框一跳出来，手指会先顿一下。",
    ],
    resume: [
      "文档又开到新一版，我先删掉了一排空话。",
      "改到一半才发现：写满不等于写清。",
      "发出去前，我只留能被追问的那几句。",
    ],
    interview: [
      "进门前，我把自我介绍又压短了一遍。",
      "对面一开口，我知道这题绕不过。",
      "结束后走路回家，脑子还在回放某一句。",
    ],
    rejection: [
      "「已读不回」弹出的瞬间，胃先紧了一下。",
      "拒信很短，短到我连生气都来不及。",
      "刷新到第三次，我把手机扣过去了。",
    ],
    choice: [
      "两个选项摆在一起，我反而更不敢动。",
      "那天晚上，我把利弊列成两列还是睡不着。",
      "不是没有选择，是怕选错成本太高。",
    ],
    life: [
      "主线之外，晚饭还是得自己做。",
      "散步走到第三个路口，脑子才松开一点。",
      "把桌子擦干净的时候，人会踏实一点。",
    ],
  };
  return pick(scenes[post.pillar] ?? scenes.life, seed);
}

function painByFormat(post: CalendarPost, seed: number): string {
  if (post.format === "tips") {
    return pick(
      [
        "我以前也以为，多做一点就会有结果。",
        "最耗人的不是忙，是忙完还是不确定有没有用。",
        "一着急，就容易把所有事一起堆上来。",
      ],
      seed,
    );
  }
  if (post.format === "emotion") {
    return pick(
      [
        "难受的时候，我最怕有人一句「想开点」。",
        "不是矫情，是真的会怀疑自己是不是慢了。",
        "情绪来的时候，道理一句都进不来。",
      ],
      seed,
    );
  }
  return pick(
    [
      "卡住的感觉很普通，普通到不好意思跟别人说。",
      "没有戏剧化崩溃，就是停在原地出不了下一格。",
      "我不是没努力，是努力的方向一度很糊。",
    ],
    seed,
  );
}

function ctaByFormat(post: CalendarPost, seed: number): string {
  if (post.format === "tips") {
    return pick(
      [
        "你要是也卡在同一步，评论区丢你的卡点，我看到会回。",
        "收藏一下，下次改的时候对着做就行。",
        "同路的人，评论区报个到，看看大家都卡在哪。",
      ],
      seed,
    );
  }
  if (post.format === "emotion") {
    return pick(
      [
        "你要是也有过这种时刻，评论区回个「同」，我就知道不是我一个人。",
        "不想讲道理也没关系，留个字就行。",
        "如果这篇让你松了一口气，把你的状态丢一句在评论区。",
      ],
      seed,
    );
  }
  return pick(
    [
      "这篇如果戳到你，告诉我你这周卡在哪一步。",
      "同频的话，评论区见。",
      "你也在路上的话，留一句你现在的真实进度。",
    ],
    seed,
  );
}

function buildHook(title: string, post: CalendarPost, seed: number): string {
  const t = cleanTitle(title) || post.titleHint;
  if (post.format === "tips") {
    return pick(
      [
        `关于「${t}」，\n我想把能直接用的几步写清楚。`,
        `如果你也在为「${t}」反复内耗，\n这篇给你能直接抄的三步。`,
        `${t}。\n我试过不少弯路，最后只留下这几条。`,
      ],
      seed,
    );
  }
  if (post.format === "emotion") {
    return pick(
      [
        `${t}。\n今天不想扮冷静。`,
        `写「${t}」的时候，\n我手还是会紧一下。`,
        `${t}。\n这篇给同样不敢示弱的人。`,
      ],
      seed,
    );
  }
  return pick(
    [
      `${t}。\n我是卡过之后，才敢这么写的。`,
      `先说一句可能不太好听的：\n${t}，真的不是靠「再拼一把」就能过。`,
      `关于「${t}」，\n我想把最真实的那几天写清楚。`,
      `${t}。\n这篇不装励志，只写我实际怎么走过来的。`,
    ],
    seed,
  );
}

function buildIdentity(post: CalendarPost, persona: CreatorPersona): string {
  if (post.trustAnchor) return endSentence(post.trustAnchor);
  const bits = [
    persona.age ? `${persona.age}岁` : null,
    persona.background || null,
    humanStage(persona.stage),
  ].filter(Boolean);
  if (bits.length) return endSentence(bits.join("，"));
  if (persona.name) return endSentence(persona.name);
  return "";
}

/** Pillar-aware actionable steps — never dump resume jargon into life posts. */
function defaultSteps(post: CalendarPost, angleLine: string): string[] {
  if (post.pillar === "life" || post.format === "emotion") {
    return [
      endSentence(`先承认这件事难：「${angleLine}」`),
      "当天只选一件小事做完，做完就停，不追加任务。",
      "睡前用一句话记下：今天哪里松了，哪里还紧。",
    ];
  }
  if (post.pillar === "resume") {
    return [
      endSentence(angleLine),
      "每句话改成「做了什么 + 结果是什么」，少写空话。",
      "改完大声读一遍：别人能不能 30 秒听懂。",
    ];
  }
  if (post.pillar === "interview") {
    return [
      endSentence(angleLine),
      "把自我介绍压到 60 秒，只留能被追问的事实。",
      "模拟一题难问题，录音听自己有没有在辩解。",
    ];
  }
  return [
    endSentence(angleLine),
    "把大问题拆成今天就能做完的一小步。",
    "做完立刻记结果：有用就留下，没用就丢掉。",
  ];
}

function uniqueLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const key = stripPeriod(line).replace(/\s+/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

function buildTipsBody(
  post: CalendarPost,
  persona: CreatorPersona,
  title: string,
  bits: string[],
  seed: number,
): string {
  const t = cleanTitle(title);
  const angleLine = humanAngle(post.angle);
  const realBits = uniqueLines(bits.map((b) => endSentence(stripPeriod(b))));

  // 「这周真实发生」用第一条素材；步骤里不再重复同一句
  const happened = realBits[0] || null;
  const stepPool = uniqueLines([
    ...realBits.slice(happened ? 1 : 0),
    ...defaultSteps(post, angleLine),
  ]).slice(0, 3);
  while (stepPool.length < 3) {
    stepPool.push(...defaultSteps(post, angleLine).slice(stepPool.length));
  }
  const steps = stepPool.slice(0, 3).map((b, i) => `${i + 1}. ${b}`);

  const pitfall = pick(
    [
      "我以前一着急，就想一天补完所有欠账。\n结果越补越乱。",
      "无效的是：一边休息一边愧疚刷手机。\n有效的是：休息就好好休息，开工就只做一件。",
      "我以前总想「全面升级」。\n现在只要求：今天推进一格，就算赢。",
    ],
    seed + 3,
  );

  const reminder = pick(
    [
      `所以我现在只抓住一件事：${endSentence(angleLine)}`,
      `这周我对自己说：${endSentence(angleLine)}`,
      `落到「${t}」，我只做这一步：${endSentence(angleLine)}`,
    ],
    seed + 5,
  );

  return [
    buildHook(title, post, seed),
    "",
    buildIdentity(post, persona),
    "",
    painByFormat(post, seed + 1),
    sceneByPillar(post, seed + 2),
    "",
    happened
      ? `这周真实发生的是：\n${happened}`
      : `围绕「${t}」，我这周只做一件事：\n${endSentence(angleLine)}`,
    "",
    "后来我留下的做法只有这几条：",
    ...steps,
    "",
    pitfall,
    "",
    reminder,
    "",
    ctaByFormat(post, seed + 4),
  ]
    .filter((line) => line !== "")
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

function buildEmotionBody(
  post: CalendarPost,
  persona: CreatorPersona,
  title: string,
  bits: string[],
  seed: number,
): string {
  const mid = bits.length
    ? bits.map((b) => endSentence(b)).join("\n\n")
    : pick(
        [
          "那天情绪上来，我没有逼自己立刻正面思考。\n我只允许自己难受一小会儿，然后去做下一件具体的小事。",
          "我把感受写下来，写完才发现：\n怕的不是失败，是「再努力也没用」这种感觉。",
          "没跟任何人诉苦。\n就自己坐着，把心跳等慢一点，再打开下一项。",
        ],
        seed,
      );

  return [
    buildHook(title, post, seed),
    "",
    buildIdentity(post, persona),
    "",
    painByFormat(post, seed + 1),
    "",
    mid,
    "",
    sceneByPillar(post, seed + 2),
    "",
    pick(
      [
        "后来我接受一件事：\n情绪可以在，动作不能停。",
        "靠想通人生没用。\n我真正能做的，是把下一步动作找回来。",
        "不要求自己马上振作。\n只要求自己别在刷新里耗一整晚。",
      ],
      seed + 3,
    ),
    "",
    `所以落到「${cleanTitle(title)}」，我只抓这一步：\n${endSentence(humanAngle(post.angle))}`,
    "",
    ctaByFormat(post, seed + 4),
  ].join("\n");
}

function buildStoryBody(
  post: CalendarPost,
  persona: CreatorPersona,
  title: string,
  bits: string[],
  seed: number,
): string {
  const angleLine = humanAngle(post.angle);
  const scene = bits[0]
    ? endSentence(bits[0])
    : `${sceneByPillar(post, seed)}\n关于「${cleanTitle(title)}」，我停了很久。`;
  const action = bits[1]
    ? endSentence(bits[1])
    : `然后我逼自己先动起来：\n${endSentence(angleLine)}\n当天只推进能完成的一小步。`;
  const reflect = bits[2]
    ? endSentence(bits[2])
    : pick(
        [
          "回头看，有效的是把问题变小。\n无效的是反复刷新，等谁来证明我还可以。",
          "真正难的往往不是能力。\n是焦虑时，容易把一件事想成整个人生的判决书。",
          "我开始少问「我是不是不行」。\n多问「今天能推进哪一格」。",
        ],
        seed + 1,
      );

  return [
    buildHook(title, post, seed),
    "",
    buildIdentity(post, persona),
    "",
    scene,
    "",
    painByFormat(post, seed + 2),
    "",
    action,
    "",
    reflect,
    "",
    `我现在给自己的路线只有一句：\n${endSentence(angleLine)}`,
    "",
    ctaByFormat(post, seed + 3),
  ].join("\n");
}

function compactBlankLines(text: string): string {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildBody(
  post: CalendarPost,
  persona: CreatorPersona,
  extraNote: string,
  titleHook = post.titleHint,
  bodySeed = 0,
): string {
  const bits = materialBits(post, extraNote);
  const seed = hashSeed(`${post.id}:${titleHook}:${extraNote}:${bodySeed}`);
  let body = "";
  if (post.format === "tips")
    body = buildTipsBody(post, persona, titleHook, bits, seed);
  else if (post.format === "emotion")
    body = buildEmotionBody(post, persona, titleHook, bits, seed);
  else body = buildStoryBody(post, persona, titleHook, bits, seed);
  return compactBlankLines(body);
}

export function generateNoteFromPost(
  post: CalendarPost,
  persona: CreatorPersona,
  extraNote = "",
  selectedTitle?: string,
  bodySeed = 0,
): GeneratedNote {
  const titleForBody = selectedTitle?.trim() || post.titleHint;
  const titles = generateTitleCandidates(post, persona, bodySeed, selectedTitle);

  const tags = [
    ...persona.noteTags,
    `#${pillarLabel(post.pillar)}`,
  ].filter((t, i, arr) => arr.indexOf(t) === i);

  const coverIdeas = [
    `大字标题「${cleanTitle(titleForBody).slice(0, 14)}」+ 真实桌面/通勤场景`,
    "人物侧脸或背影 + 一句结论（后期叠字）",
    "前后对比：混乱日程 vs 结构化小步",
  ];

  return {
    titles,
    body: buildBody(post, persona, extraNote, titleForBody, bodySeed),
    tags,
    coverIdeas,
    coverPrompt: [
      "Xiaohongshu vertical cover",
      titleForBody,
      pillarLabel(post.pillar),
      persona.name,
      "warm paper coral accent, no text in image",
    ].join(", "),
  };
}

export function formatFullNote(note: GeneratedNote, titleIndex = 0): string {
  const title = note.titles[titleIndex] ?? note.titles[0];
  return `${title}\n\n${note.body}\n\n${note.tags.join(" ")}`;
}
