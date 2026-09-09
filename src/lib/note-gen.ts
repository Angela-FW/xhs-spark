import { PERSONA, pillarLabel } from "./persona";
import type { CalendarPost } from "./year-calendar";

export type GeneratedNote = {
  titles: string[];
  body: string;
  tags: string[];
  coverIdeas: string[];
  coverPrompt: string;
};

export function generateNoteFromPost(
  post: CalendarPost,
  extraNote = "",
): GeneratedNote {
  const materials = post.materials.map((m) => m.polished).filter(Boolean);
  const materialBlock = materials.length
    ? materials.map((m, i) => `${i + 1}. ${m}`).join("\n")
    : "1. 把本周真实发生的一件小事写清楚（时间/动作/结果）\n2. 承认一处不确定，再给一个下一步";

  const trust = post.trustAnchor
    ? `\n信任锚点（文中自然带一句）：${post.trustAnchor}`
    : "";

  const titles = [
    post.titleHint,
    `${pillarLabel(post.pillar)}｜${post.hooks[0] ?? "真实记录"}`,
    `37岁双非求职：${post.titleHint.replace(/^.*?｜/, "").slice(0, 18)}`,
    `${post.format === "tips" ? "干货" : post.format === "emotion" ? "说实话" : "记录"}｜${post.angle.slice(0, 16)}`,
    `写给同样在找工作的人｜${pillarLabel(post.pillar)}`,
  ];

  const opener =
    post.format === "tips"
      ? `先说结论：关于「${pillarLabel(post.pillar)}」，我这周只验证一件事——${post.angle}`
      : post.format === "emotion"
        ? `今天不想扮冷静。关于「${post.titleHint}」，我只想把真实感受写清楚。`
        : `我已经在找工作的路上了。这篇不从头励志，只截取「${post.titleHint}」这一段。`;

  const body = `${opener}

人设背景（不必每次全写，可藏一句）：${PERSONA.age}岁，${PERSONA.education}，${PERSONA.stage}。
角度：${post.angle}${trust}

可写进正文的素材：
${materialBlock}
${extraNote ? `\n你补充的当下情况：\n${extraNote}\n` : ""}
结构建议：
1. 场景开头（发生了什么）
2. 我做了什么（具体动作，可复用）
3. 复盘：有效/无效各一条
4. 结尾提问：你这周卡在哪一步？

语气提醒：${PERSONA.voice}

——
如果这篇对你有一点用，评论区告诉我你的卡点；我看到会回。`;

  const tags = [
    "#求职",
    "#离职重启",
    "#大龄求职",
    "#双非",
    `#${pillarLabel(post.pillar)}`,
    "#简历",
    "#面试",
    "#真实分享",
    "#职场女性",
    "#小红书成长",
  ];

  const coverIdeas = [
    `大字标题「${post.titleHint.slice(0, 14)}」+ 桌面简历/笔记真实场景`,
    "人物侧脸/背影通勤感 + 一句结论手写标注（后期可叠字）",
    "前后对比：焦虑日程 vs 结构化投递表",
  ];

  return {
    titles,
    body,
    tags,
    coverIdeas,
    coverPrompt: [
      "Xiaohongshu vertical cover",
      post.titleHint,
      pillarLabel(post.pillar),
      "warm paper coral accent, no text in image",
    ].join(", "),
  };
}

export function formatFullNote(
  note: GeneratedNote,
  titleIndex = 0,
): string {
  const title = note.titles[titleIndex] ?? note.titles[0];
  return `${title}\n\n${note.body}\n\n${note.tags.join(" ")}`;
}
