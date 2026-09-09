import { PERSONA, pillarLabel } from "./persona";
import type { CalendarPost } from "./year-calendar";

export type GeneratedNote = {
  titles: string[];
  body: string;
  tags: string[];
  coverIdeas: string[];
  coverPrompt: string;
};

function materialParagraphs(post: CalendarPost, extraNote: string): string[] {
  const fromMats = post.materials.map((m) => m.polished).filter(Boolean);
  const lines: string[] = [];
  if (extraNote.trim()) {
    lines.push(extraNote.trim());
  }
  for (const m of fromMats.slice(0, 3)) lines.push(m);
  return lines;
}

function buildBody(post: CalendarPost, extraNote: string): string {
  const bits = materialParagraphs(post, extraNote);
  const trust = post.trustAnchor
    ? `顺便说一句：${post.trustAnchor}。`
    : `${PERSONA.age}岁、${PERSONA.education}，我已经在找工作的路上了——这篇不装励志，只写清楚。`;

  if (post.format === "tips") {
    const steps = bits.length
      ? bits.map((b, i) => `${i + 1}. ${b}`).join("\n")
      : [
          `1. 先把目标说清楚：这篇围绕「${post.angle}」。`,
          `2. 我本周实际做了：把这件事拆成可检查的小步，每天只推进一格。`,
          `3. 复查标准：能向别人用一分钟讲明白，并且留下可验证记录。`,
        ].join("\n");

    return `先说结论：关于「${post.titleHint}」，我这周只抓住一件事——${post.angle}。

${trust}

可以直接抄的做法：
${steps}

我踩过的坑：一上来写太满、想一次证明所有价值。后来我改成「一次只改一个变量」，反而更稳。

如果你也卡在同类问题上，评论区丢一句你的卡点；我看到会回。`;
  }

  if (post.format === "emotion") {
    const mid = bits.length
      ? bits.map((b) => b).join("\n\n")
      : `那天情绪上来的时候，我没有逼自己立刻「正面思考」。我只做了两件事：把感受写下来，然后规定自己难过到某个点必须停，去干下一件具体的小事。`;

    return `今天不想扮冷静。关于「${post.titleHint}」，我想把真实感受写清楚。

${trust}

${mid}

写到这里我仍会紧一下，但紧完之后我知道下一步是什么：回到${pillarLabel(post.pillar)}里那个可执行动作，而不是跟自己辩论对不对。

角度我提醒自己：${post.angle}

你要是也有过类似时刻，评论区可以只回一个字「同」，我就知道不是我一个人。`;
  }

  // story
  const scene = bits[0]
    ? bits[0]
    : `那天我对着「${post.titleHint}」这件事停了很久。不是戏剧化的崩溃，是普通的停顿——停完，还是得继续。`;
  const action = bits[1]
    ? bits[1]
    : `然后我做了具体动作：围绕「${post.angle}」，只推进能在当天完成的一小步，并记下来。`;
  const reflect = bits[2]
    ? bits[2]
    : `复盘很短：有效的是把问题变小；无效的是反复刷新消息、期待一次证明自己。`;

  return `${scene}

${trust}

${action}

${reflect}

我还在路上。这篇如果对你有一点用，评论区告诉我你这周卡在哪一步。`;
}

export function generateNoteFromPost(
  post: CalendarPost,
  extraNote = "",
): GeneratedNote {
  const titles = [
    post.titleHint,
    `${pillarLabel(post.pillar)}｜${post.hooks[0] ?? "真实记录"}`,
    `37岁双非｜${post.titleHint.replace(/^.*?｜/, "").slice(0, 20)}`,
    `${post.format === "tips" ? "干货" : post.format === "emotion" ? "说实话" : "记录"}｜${post.hooks[1] ?? post.angle.slice(0, 12)}`,
    `写给同样在找工作的人｜${pillarLabel(post.pillar)}`,
  ];

  const tags = [
    "#求职",
    "#离职重启",
    "#大龄求职",
    "#双非",
    `#${pillarLabel(post.pillar)}`,
    "#真实分享",
    "#职场女性",
    "#简历",
    "#面试",
    "#生活记录",
  ];

  const coverIdeas = [
    `大字标题「${post.titleHint.slice(0, 14)}」+ 真实桌面/通勤场景`,
    "人物侧脸或背影 + 一句结论（后期叠字）",
    "前后对比：混乱日程 vs 结构化小步",
  ];

  return {
    titles,
    body: buildBody(post, extraNote),
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

export function formatFullNote(note: GeneratedNote, titleIndex = 0): string {
  const title = note.titles[titleIndex] ?? note.titles[0];
  return `${title}\n\n${note.body}\n\n${note.tags.join(" ")}`;
}
