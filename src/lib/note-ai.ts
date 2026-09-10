import {
  buildBody,
  generateNoteFromPost,
  type GeneratedNote,
} from "@/lib/note-gen";
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

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function materialsForPrompt(post: CalendarPost, extraNote: string): string[] {
  const out: string[] = [];
  if (extraNote.trim()) out.push(extraNote.trim().replace(/\s+/g, " "));
  for (const m of post.materials) {
    const t = m.polished.replace(/\s+/g, " ").trim();
    if (t) out.push(t);
  }
  return out.slice(0, 6);
}

async function fetchNoteBodyOnce(
  post: CalendarPost,
  persona: CreatorPersona,
  title: string,
  extraNote: string,
): Promise<string> {
  const res = await fetch("/api/note-generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      angle: post.angle,
      format: post.format,
      pillar: post.pillar,
      materials: materialsForPrompt(post, extraNote),
      persona: {
        stage: persona.stage,
        voice: persona.voice,
        audience: persona.audience,
        background: persona.background,
      },
      extraNote,
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

/** Try Cloudflare text model up to 3 times; then fall back to local templates. */
export async function generateNoteBodyWithRetry(
  post: CalendarPost,
  persona: CreatorPersona,
  title: string,
  extraNote: string,
  bodySeed = 0,
): Promise<NoteBodyResult> {
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const body = await fetchNoteBodyOnce(post, persona, title, extraNote);
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
