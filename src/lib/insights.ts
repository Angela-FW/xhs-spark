import { PILLARS, type PillarId } from "./persona";
import type { CalendarPost } from "./year-calendar";
import type { InsightCard } from "./store";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function routePillar(text: string): PillarId {
  const scores = PILLARS.map((p) => ({
    id: p.id,
    score: p.keywords.reduce(
      (acc, kw) => acc + (text.includes(kw) ? 1 : 0),
      0,
    ),
  }));
  scores.sort((a, b) => b.score - a.score);
  if (scores[0].score === 0) return "resume";
  return scores[0].id;
}

function polishLine(raw: string): string {
  let t = raw.trim().replace(/\s+/g, " ");
  t = t.replace(/^(我觉得|我感觉|其实|真的是|就是)/, "");
  if (!/[。！？]$/.test(t)) t += "。";
  // Soften chicken-soup openers
  t = t.replace(/一定要加油/g, "先把下一步做清楚");
  t = t.replace(/相信自己/g, "把证据写进经历里");
  return t;
}

function needsDesensitize(text: string): string | undefined {
  if (/(公司名|老板姓|同事名字|具体薪资\d{4,})/.test(text)) {
    return "可能含可识别信息，发布前请脱敏（公司/人名/精确薪资）。";
  }
  if (/[A-Za-z]{2,}科技|[一-龥]{2,4}(有限公司|集团)/.test(text)) {
    return "疑似含公司名，建议改成行业+规模描述。";
  }
  return undefined;
}

export function processInsights(rawBlob: string): InsightCard[] {
  const chunks = rawBlob
    .split(/\n{2,}|\n(?=[-•·]|\d+[.、])|(?<=[。！？])\s*(?=[^\s])/u)
    .map((s) => s.replace(/^[-•·\d.、\s]+/, "").trim())
    .filter((s) => s.length >= 8);

  const unique: string[] = [];
  for (const c of chunks) {
    if (!unique.some((u) => u.slice(0, 20) === c.slice(0, 20))) unique.push(c);
  }

  const source = unique.length ? unique : [rawBlob.trim()].filter(Boolean);

  return source.slice(0, 12).map((raw) => {
    const pillar = routePillar(raw);
    const polished = polishLine(raw);
    return {
      id: uid("ins"),
      raw,
      summary: raw.length > 36 ? `${raw.slice(0, 36)}…` : raw,
      polished,
      pillar,
      createdAt: new Date().toISOString(),
      assignedPostIds: [],
      desensitizeNote: needsDesensitize(raw),
    };
  });
}

export function recommendPostsForInsight(
  insight: InsightCard,
  posts: CalendarPost[],
  fromWeek = 1,
): { post: CalendarPost; reason: string }[] {
  const candidates = posts
    .filter((p) => p.status === "planned" && p.week >= fromWeek)
    .filter((p) => p.week <= fromWeek + 8 || p.pillar === insight.pillar);

  const scored = candidates
    .map((post) => {
      let score = 0;
      const reasons: string[] = [];
      if (post.pillar === insight.pillar) {
        score += 5;
        reasons.push("支柱一致");
      }
      if (post.week <= fromWeek + 4) {
        score += 2;
        reasons.push("近四周可发");
      } else if (post.week > fromWeek + 8) {
        score -= 1;
        reasons.push("跨阶段存稿");
      }
      if (post.materials.length === 0) {
        score += 1;
        reasons.push("尚无素材");
      }
      return { post, score, reason: reasons.join(" · ") || "可挂载" };
    })
    .sort((a, b) => b.score - a.score || a.post.week - b.post.week);

  return scored.slice(0, 3).map(({ post, reason }) => ({ post, reason }));
}
