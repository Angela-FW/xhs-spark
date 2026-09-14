import { withAuthHeaders } from "@/lib/auth-fetch";
import type { CreatorPersona } from "@/lib/persona";
import type { InsightCard } from "@/lib/store";

export async function polishInsightWithAi(
  raw: string,
  persona?: CreatorPersona,
  pillar?: InsightCard["pillar"],
): Promise<string | null> {
  const res = await fetch("/api/insight-polish", {
    method: "POST",
    headers: await withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      raw,
      pillar,
      persona: persona
        ? {
            name: persona.name,
            voice: persona.voice,
            audience: persona.audience,
            background: persona.background,
          }
        : undefined,
    }),
  });
  const data = (await res.json().catch(() => null)) as {
    polished?: string;
    error?: string;
  } | null;
  if (!res.ok || !data?.polished?.trim()) return null;
  return data.polished.trim();
}

/** Prefer model rewrite; keep local polish if the model fails. */
export async function polishInsightCards(
  cards: InsightCard[],
  persona?: CreatorPersona,
): Promise<InsightCard[]> {
  return Promise.all(
    cards.map(async (card) => {
      try {
        const polished = await polishInsightWithAi(
          card.raw,
          persona,
          card.pillar,
        );
        if (polished) return { ...card, polished };
      } catch {
        /* keep local */
      }
      return card;
    }),
  );
}
