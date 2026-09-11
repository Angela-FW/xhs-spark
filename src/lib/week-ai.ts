"use client";

import { withAuthHeaders } from "@/lib/auth-fetch";
import type { CreatorPersona } from "@/lib/persona";
import type { CalendarPost } from "@/lib/year-calendar";

export type WeekTopicPatch = {
  id: string;
  titleHint: string;
  angle: string;
};

/** Use Cloudflare text model to rewrite next-week topic titles/angles. */
export async function generateWeekTopicsWithAi(
  persona: CreatorPersona,
  posts: CalendarPost[],
  usedTitles: string[],
): Promise<WeekTopicPatch[]> {
  const res = await fetch("/api/week-topics", {
    method: "POST",
    headers: await withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      persona: {
        name: persona.name,
        age: persona.age,
        stage: persona.stage,
        voice: persona.voice,
        audience: persona.audience,
        background: persona.background,
      },
      posts: posts.map((p) => ({
        id: p.id,
        pillar: p.pillar,
        format: p.format,
        phase: p.phase,
      })),
      usedTitles,
    }),
  });

  const data = (await res.json().catch(() => null)) as {
    topics?: WeekTopicPatch[];
    error?: string;
  } | null;

  if (!res.ok || !data?.topics?.length) {
    throw new Error(data?.error || `选题生成失败（${res.status}）`);
  }

  return data.topics.filter((t) => t.id && t.titleHint && t.angle);
}
