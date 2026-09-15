import {
  buildBody,
  generateNoteFromPost,
  humanAngle,
  type GeneratedNote,
} from "@/lib/note-gen";
import { withAuthHeaders } from "@/lib/auth-fetch";
import type { CreatorPersona } from "@/lib/persona";
import type { CalendarPost } from "@/lib/year-calendar";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 600;

export type NoteBodyResult = {
  body: string;
  source: "ai" | "local";
  attempts: number;
  error?: string;
};

export type NoteInsightFact = {
  id: string;
  raw?: string;
  polished?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function tidyFact(value: string | undefined): string {
  return (value || "").replace(/[ \t]+\n/g, "\n").trim();
}

/** Prefer original 灵感原文, then polished material, then summary. */
export function materialsForPrompt(
  post: CalendarPost,
  insights?: NoteInsightFact[],
): string[] {
  const out: string[] = [];
  for (const m of post.materials) {
    const insight = m.sourceInsightId
      ? insights?.find((i) => i.id === m.sourceInsightId)
      : undefined;
    const raw = tidyFact(insight?.raw);
    const polished = tidyFact(m.polished || insight?.polished);
    const summary = tidyFact(m.summary);
    const t =
      (raw && raw.length >= polished.length ? raw : "") ||
      polished ||
      raw ||
      summary;
    if (t) out.push(t);
  }
  return out.slice(0, 8);
}

async function fetchNoteBodyOnce(
  post: CalendarPost,
  persona: CreatorPersona,
  title: string,
  extraNote: string,
  previousBody?: string,
  insights?: NoteInsightFact[],
): Promise<string> {
  const res = await fetch("/api/note-generate", {
    method: "POST",
    headers: await withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      title,
      angle: post.angle ? humanAngle(post.angle) : "",
      format: post.format,
      pillar: post.pillar,
      materials: materialsForPrompt(post, insights),
      persona: {
        name: persona.name,
        age: persona.age,
        gender: persona.gender,
        stage: persona.stage,
        voice: persona.voice,
        audience: persona.audience,
        background: persona.background,
        contentMix: persona.contentMix,
      },
      extraNote,
      previousBody: previousBody?.trim() || undefined,
    }),
  });

  const data = (await res.json().catch(() => null)) as {
    body?: string;
    error?: string;
  } | null;

  if (!res.ok || !data?.body?.trim()) {
    throw new Error(data?.error || `生成失败（${res.status}）`);
  }
  return data.body.trim();
}

/** Try site text model up to 3 times; then fall back to local templates. */
export async function generateNoteBodyWithRetry(
  post: CalendarPost,
  persona: CreatorPersona,
  title: string,
  extraNote: string,
  bodySeed = 0,
  previousBody?: string,
  insights?: NoteInsightFact[],
): Promise<NoteBodyResult> {
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const body = await fetchNoteBodyOnce(
        post,
        persona,
        title,
        extraNote,
        previousBody,
        insights,
      );
      return { body, source: "ai", attempts: attempt };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  return {
    body: buildBody(post, persona, extraNote, title, bodySeed),
    source: "local",
    attempts: MAX_ATTEMPTS,
    error: lastError || "模型暂时不可用",
  };
}

/** Full note shell + AI/local body. Titles stay local. */
export async function generateNoteBodyForPost(
  post: CalendarPost,
  persona: CreatorPersona,
  extraNote: string,
  title: string,
  bodySeed = 0,
  keepTitles?: string[],
  previousBody?: string,
  insights?: NoteInsightFact[],
): Promise<{ note: GeneratedNote; result: NoteBodyResult }> {
  const base = generateNoteFromPost(
    post,
    persona,
    extraNote,
    title,
    bodySeed,
  );
  const result = await generateNoteBodyWithRetry(
    post,
    persona,
    title,
    extraNote,
    bodySeed,
    previousBody,
    insights,
  );
  return {
    note: {
      ...base,
      titles: keepTitles?.length ? keepTitles : base.titles,
      body: result.body,
    },
    result,
  };
}
