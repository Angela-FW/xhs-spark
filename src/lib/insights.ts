import { PILLARS, defaultPillarForPersona, type CreatorPersona, type PillarId } from "./persona";
import type { CalendarPost } from "./year-calendar";
import type { InsightCard } from "./store";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function routePillar(
  text: string,
  persona?: CreatorPersona,
): PillarId {
  const scores = PILLARS.map((p) => ({
    id: p.id,
    score: p.keywords.reduce((acc, kw) => {
      if (!text.includes(kw)) return acc;
      // Prefer longer / more specific keywords (e.g. 面试 > 稳定)
      return acc + Math.max(1, Math.round(kw.length / 2));
    }, 0),
  }));
  // Soft boosts for common phrases that are easy to misroute
  if (/面试官|一面|二面|终面|自我介绍/.test(text)) {
    const hit = scores.find((s) => s.id === "interview");
    if (hit) hit.score += 3;
  }
  if (/简历|投递|海投|作品集/.test(text)) {
    const hit = scores.find((s) => s.id === "resume");
    if (hit) hit.score += 2;
  }
  if (/稳定性/.test(text) && /面试/.test(text)) {
    const age = scores.find((s) => s.id === "age-edu");
    if (age) age.score = Math.max(0, age.score - 2);
  }
  if (persona?.contentMix === "life") {
    const life = scores.find((s) => s.id === "life");
    if (life) life.score += 1;
  }
  scores.sort((a, b) => b.score - a.score);
  if (scores[0].score === 0) {
    return persona ? defaultPillarForPersona(persona) : "resume";
  }
  return scores[0].id;
}

/** Split Chinese prose into clause-ish pieces. */
function splitClauses(text: string): string[] {
  return text
    .split(/[，,；;。！？\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

function softenFiller(s: string): string {
  return s
    .replace(/^(我觉得|我感觉|其实|真的是|就是|然后就|然后|突然就)/, "")
    .replace(/一定要加油/g, "先把下一步做清楚")
    .replace(/非常非常/g, "挺")
    .replace(/真的很/g, "很")
    .replace(/^经过了/, "")
    .replace(/已经渐渐/g, "渐渐")
    .replace(/已经是/g, "是")
    .replace(/总觉得/g, "老觉得")
    .trim();
}

function ensurePeriod(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return /[。！？…]$/.test(t) ? t : `${t}。`;
}

function stripPeriod(s: string): string {
  return s.replace(/[。！？…]+$/, "").trim();
}

function normalizeCmp(s: string): string {
  return s.replace(/[。！？，,\s\n]/g, "");
}

function compactLines(text: string): string {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/，+/g, "，")
    .replace(/。+/g, "。")
    .replace(/，。/g, "。")
    .trim();
}

function rewriteClause(clause: string): string {
  return softenFiller(clause)
    .replace(/一边([^，。]+)一边([^，。]+)一边([^，。]+)/, "一边$1，一边$2，一边$3")
    .replace(/我已经渐渐适应了/, "我渐渐适应了")
    .replace(/我渐渐适应了当下的节奏/, "我渐渐摸到了当下的节奏")
    .replace(/适应了当下的节奏/, "摸到了当下的节奏")
    .trim();
}

/**
 * Polish only what the user wrote: shorter lines, clearer rhythm, Xiaohongshu voice.
 * Never invent unrelated advice (no pillar template closers).
 */
export function polishLine(raw: string, _pillar: PillarId = "resume"): string {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (!cleaned) return cleaned;

  const clauses = splitClauses(cleaned)
    .map(rewriteClause)
    .filter(Boolean);
  if (!clauses.length) return ensurePeriod(rewriteClause(cleaned));

  const dayHit = cleaned.match(/(?:第|经过了?)\s*(\d+)\s*天/);
  const hasParallel = /一边.+一边/.test(cleaned);
  const adaptHit = /适应|渐渐|节奏|习惯/.test(cleaned);

  let lines: string[] = [];

  if (dayHit && adaptHit) {
    const day = dayHit[1];
    const rest = clauses
      .map((c) =>
        stripPeriod(
          c
            .replace(/(?:第|经过了?)?\s*\d+\s*天的?调整/, "")
            .replace(/(?:第|经过了?)?\s*\d+\s*天/, "")
            .trim(),
        ),
      )
      .filter(Boolean);
    lines = [`${day}天了。`, ""];
    if (rest[0]) lines.push(ensurePeriod(rest[0]));
    if (rest.length > 1) {
      lines.push("");
      const tail = rest.slice(1);
      if (hasParallel || tail.some((t) => t.includes("一边"))) {
        lines.push(
          ...tail.flatMap((part) => {
            const bits = part.split(/一边/).map((b) => b.trim()).filter(Boolean);
            if (bits.length > 1 || /^一边/.test(part) || part.includes("一边")) {
              return part
                .split(/(?=一边)/)
                .map((b) => b.trim())
                .filter(Boolean)
                .map((b) => ensurePeriod(b));
            }
            return [ensurePeriod(part)];
          }),
        );
      } else {
        lines.push(...tail.map((t) => ensurePeriod(t)));
      }
    }
  } else if (clauses.length === 1) {
    lines = [ensurePeriod(clauses[0])];
  } else if (clauses.length === 2) {
    lines = [ensurePeriod(clauses[0]), "", ensurePeriod(clauses[1])];
  } else {
    // Hook from first clause, body from middle, soft close from last — all from input
    lines = [
      ensurePeriod(clauses[0]),
      "",
      ...clauses.slice(1, -1).map((c) => ensurePeriod(c)),
      "",
      ensurePeriod(clauses[clauses.length - 1]),
    ];
  }

  let polished = compactLines(lines.filter((l, i, arr) => !(l === "" && arr[i - 1] === "")).join("\n"));
  if (!/[。！？]$/.test(polished)) polished += "。";

  // If somehow identical, only change rhythm (line breaks), still no invented content
  if (normalizeCmp(polished) === normalizeCmp(cleaned)) {
    polished = compactLines(
      clauses.map((c) => ensurePeriod(c)).join("\n\n"),
    );
  }

  return polished;
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

export function processInsights(
  rawBlob: string,
  persona?: CreatorPersona,
): InsightCard[] {
  const chunks = rawBlob
    .split(/\n{2,}|\n(?=[-•·]|\d+[.、])/u)
    .map((s) => s.replace(/^[-•·\d.、\s]+/, "").trim())
    .filter((s) => s.length >= 8);

  // Prefer whole paragraphs; if user pasted one block, keep as one insight
  const source =
    chunks.length > 1
      ? chunks
      : [rawBlob.trim()].filter((s) => s.length >= 8);

  const unique: string[] = [];
  for (const c of source) {
    if (!unique.some((u) => u.slice(0, 24) === c.slice(0, 24))) unique.push(c);
  }

  return unique.slice(0, 12).map((raw) => {
    const pillar = routePillar(raw, persona);
    const polished = polishLine(raw, pillar);
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
  const keywords = collectKeywords(`${insight.raw} ${insight.polished}`);
  const candidates = posts
    .filter((p) => p.status === "planned" && p.week >= fromWeek)
    .filter((p) => p.week <= fromWeek + 5 || p.pillar === insight.pillar);

  const scored = candidates
    .map((post) => {
      let score = 0;
      const reasons: string[] = [];
      const weekGap = post.week - fromWeek;
      const overlap = keywordOverlap(
        keywords,
        collectKeywords(`${post.titleHint} ${post.angle} ${post.hooks.join(" ")}`),
      );

      if (post.pillar === insight.pillar) {
        score += 4;
        reasons.push("支柱一致");
      }

      if (weekGap <= 1) {
        score += 4;
        reasons.push("提交时间很近");
      } else if (weekGap <= 3) {
        score += 2.5;
        reasons.push("近几周可发");
      } else if (weekGap <= 5) {
        score += 1;
        reasons.push("可提前备稿");
      } else {
        score -= 3;
        reasons.push("离当前太远");
      }

      if (overlap > 0) {
        score += Math.min(4, overlap * 1.4);
        reasons.push(`内容匹配 ${overlap} 处`);
      }

      if (post.materials.length === 0) {
        score += 0.6;
        reasons.push("尚无素材");
      }

      return { post, score, reason: reasons.join(" · ") || "可挂载" };
    })
    .sort((a, b) => b.score - a.score || a.post.week - b.post.week);

  return scored.slice(0, 3).map(({ post, reason }) => ({ post, reason }));
}

function collectKeywords(text: string): string[] {
  const hits = new Set<string>();
  for (const pillar of PILLARS) {
    for (const keyword of pillar.keywords) {
      if (keyword.length >= 2 && text.includes(keyword)) hits.add(keyword);
    }
  }
  for (const token of text.split(/[，,。；;：:\s、|]+/)) {
    const cleaned = token.trim();
    if (cleaned.length >= 2 && cleaned.length <= 8) hits.add(cleaned);
  }
  return Array.from(hits);
}

function keywordOverlap(a: string[], b: string[]): number {
  const setB = new Set(b);
  let count = 0;
  for (const key of a) {
    if (setB.has(key)) count += 1;
  }
  return count;
}
