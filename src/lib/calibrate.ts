import {
  PILLARS,
  pillarLabel,
  type PillarId,
} from "./persona";
import type {
  AppState,
  CalibrationSnapshot,
  FeedbackEntry,
  PendingCalibration,
  PillarWeights,
} from "./store";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function clampWeight(n: number) {
  return Math.max(0.4, Math.min(2.2, Math.round(n * 100) / 100));
}

export function scoreEngagement(f: FeedbackEntry): number {
  const reads = f.reads || 1;
  const interact =
    (f.likes || 0) + (f.collects || 0) * 2 + (f.comments || 0) * 3;
  const rate = interact / reads;
  const vibeBoost = f.vibe === "strong" ? 1.3 : f.vibe === "flop" ? 0.6 : 1;
  return rate * vibeBoost;
}

export function proposeFromFeedback(
  state: AppState,
  entry: FeedbackEntry,
): PendingCalibration {
  const post = state.posts.find((p) => p.id === entry.postId);
  const weights = { ...state.weights };
  const summaryParts: string[] = [];

  if (post) {
    const delta =
      entry.vibe === "strong" ? 0.15 : entry.vibe === "flop" ? -0.12 : 0.03;
    weights[post.pillar] = clampWeight(weights[post.pillar] + delta);
    summaryParts.push(
      `${pillarLabel(post.pillar)}权重 ${delta >= 0 ? "+" : ""}${delta}`,
    );
  }

  const moreText = `${entry.wantMore} ${entry.commentQuotes}`;
  const lessText = entry.wantLess;
  for (const p of PILLARS) {
    if (p.keywords.some((k) => moreText.includes(k))) {
      weights[p.id] = clampWeight(weights[p.id] + 0.1);
      summaryParts.push(`看法要求加强「${p.label}」`);
    }
    if (p.keywords.some((k) => lessText.includes(k))) {
      weights[p.id] = clampWeight(weights[p.id] - 0.1);
      summaryParts.push(`看法要求减少「${p.label}」`);
    }
  }

  if (entry.vibe === "strong" && (entry.collects || 0) > (entry.likes || 0)) {
    summaryParts.push("收藏偏高 → 后续偏干货角度");
  }
  if (entry.vibe === "flop") {
    summaryParts.push("翻车感 → 近四周减少同类空泛叙事");
  }

  const future = state.posts
    .filter((p) => p.status === "planned")
    .sort((a, b) => a.week - b.week || a.indexInWeek - b.indexInWeek)
    .slice(0, 24);

  const rankedPillars = (Object.keys(weights) as PillarId[]).sort(
    (a, b) => weights[b] - weights[a],
  );

  const patch: PendingCalibration["patch"] = [];
  for (const p of future) {
    const prefer = rankedPillars[0];
    const second = rankedPillars[1];
    const shouldTilt =
      weights[p.pillar] + 0.25 < weights[prefer] && p.format !== "tips";

    if (shouldTilt && p.indexInWeek !== 0) {
      const target = p.week % 2 === 0 ? prefer : second;
      patch.push({
        postId: p.id,
        pillar: target,
        angle: `校准后侧重「${pillarLabel(target)}」：结合你的最新反馈调整叙事切口`,
        titleHint: `${pillarLabel(target)}｜${p.titleHint.replace(/^.*?｜/, "")}`,
        format: entry.vibe === "strong" && (entry.collects || 0) > 5 ? "tips" : p.format,
      });
    } else if (entry.wantMore && p.pillar === post?.pillar) {
      patch.push({
        postId: p.id,
        angle: `${p.angle}｜强化：${entry.wantMore.slice(0, 40)}`,
      });
    }
  }

  let postsPerWeekPatch: PendingCalibration["postsPerWeekPatch"];
  if (entry.vibe === "strong" && scoreEngagement(entry) > 0.08) {
    const weeks = Array.from(new Set(future.map((p) => p.week))).slice(0, 4);
    postsPerWeekPatch = weeks.map((week) => ({
      week,
      postsPerWeek: Math.min(
        4,
        (state.weekMeta.find((w) => w.week === week)?.postsPerWeek ?? 3) + 0,
      ),
    }));
    summaryParts.push("数据尚可，维持近四周节奏");
  }

  return {
    id: uid("pending"),
    source: "feedback",
    summary: summaryParts.join("；") || "根据本条反馈微调未来权重与角度",
    weightsAfter: weights,
    patch: patch.slice(0, 12),
    postsPerWeekPatch,
  };
}

export function applyPending(
  state: AppState,
  pending: PendingCalibration,
): AppState {
  const postsBefore = pending.patch.map((p) => {
    const post = state.posts.find((x) => x.id === p.postId)!;
    return {
      id: post.id,
      titleHint: post.titleHint,
      angle: post.angle,
      pillar: post.pillar,
      format: post.format,
    };
  });

  let posts = state.posts.map((post) => {
    const hit = pending.patch.find((p) => p.postId === post.id);
    if (!hit) return post;
    return {
      ...post,
      titleHint: hit.titleHint ?? post.titleHint,
      angle: hit.angle ?? post.angle,
      pillar: hit.pillar ?? post.pillar,
      format: hit.format ?? post.format,
    };
  });

  let weekMeta = state.weekMeta;
  if (pending.postsPerWeekPatch?.length) {
    weekMeta = weekMeta.map((w) => {
      const hit = pending.postsPerWeekPatch!.find((p) => p.week === w.week);
      return hit ? { ...w, postsPerWeek: hit.postsPerWeek } : w;
    });
  }

  const snap: CalibrationSnapshot = {
    id: uid("snap"),
    createdAt: new Date().toISOString(),
    source: pending.source,
    summary: pending.summary,
    weightsBefore: { ...state.weights },
    weightsAfter: { ...pending.weightsAfter },
    changedPostIds: pending.patch.map((p) => p.postId),
    postsBefore,
  };

  return {
    ...state,
    posts,
    weekMeta,
    weights: pending.weightsAfter,
    pending: null,
    snapshots: [snap, ...state.snapshots].slice(0, 30),
  };
}

export function undoLastSnapshot(state: AppState): AppState {
  const snap = state.snapshots[0];
  if (!snap) return state;
  const posts = state.posts.map((post) => {
    const before = snap.postsBefore.find((p) => p.id === post.id);
    if (!before) return post;
    return {
      ...post,
      titleHint: before.titleHint,
      angle: before.angle,
      pillar: before.pillar,
      format: before.format,
    };
  });
  return {
    ...state,
    posts,
    weights: snap.weightsBefore,
    snapshots: state.snapshots.slice(1),
  };
}

export function describePending(pending: PendingCalibration): string {
  const lines = [
    pending.summary,
    `将调整 ${pending.patch.length} 篇未来笔记的角度/支柱`,
  ];
  for (const p of pending.patch.slice(0, 5)) {
    lines.push(
      `· ${p.postId}${p.pillar ? ` → ${pillarLabel(p.pillar)}` : ""}${
        p.titleHint ? `｜${p.titleHint}` : ""
      }`,
    );
  }
  if (pending.patch.length > 5) lines.push(`· …另有 ${pending.patch.length - 5} 篇`);
  return lines.join("\n");
}
