/** Parse structured cover briefs like 内容/风格/颜色. */

export type CoverBrief = {
  raw: string;
  contentItems: string[];
  style: string;
  color: string;
  /** User clearly wants readable text on the cover. */
  wantsText: boolean;
};

export function parseCoverBrief(prompt: string): CoverBrief {
  const raw = prompt.trim();
  const content =
    matchField(raw, "内容") ||
    matchField(raw, "文案") ||
    matchField(raw, "文字");
  const style = matchField(raw, "风格") || matchField(raw, "样式") || "";
  const color = matchField(raw, "颜色") || matchField(raw, "配色") || "";

  const contentItems = splitItems(content);
  const wantsText =
    contentItems.length > 0 ||
    /加文字|配文字|标题文字|文字内容|写上|带字/.test(raw);

  return { raw, contentItems, style, color, wantsText };
}

function matchField(text: string, label: string): string {
  const re = new RegExp(
    `${label}\\s*[:：]\\s*([^\\n]+)`,
    "i",
  );
  const m = text.match(re);
  return m?.[1]?.trim() || "";
}

function splitItems(value: string): string[] {
  if (!value.trim()) return [];
  return value
    .split(/[,，、;；|/]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseColor(colorField: string, styleField: string): {
  bg0: string;
  bg1: string;
  ink: string;
  accent: string;
  card: string;
} {
  const blob = `${colorField} ${styleField}`;
  if (/浅紫|淡紫|紫/.test(blob)) {
    return {
      bg0: "#f3eef8",
      bg1: "#e4d7f0",
      ink: "#3d2a52",
      accent: "#8b6bb0",
      card: "rgba(255,255,255,0.72)",
    };
  }
  if (/蓝/.test(blob)) {
    return {
      bg0: "#eef4fb",
      bg1: "#d7e6f6",
      ink: "#1e3a5f",
      accent: "#4a7ab5",
      card: "rgba(255,255,255,0.72)",
    };
  }
  if (/珊瑚|橙|暖/.test(blob)) {
    return {
      bg0: "#fff5f0",
      bg1: "#fde4d8",
      ink: "#5c2e22",
      accent: "#d4785a",
      card: "rgba(255,255,255,0.75)",
    };
  }
  if (/绿/.test(blob)) {
    return {
      bg0: "#f1f7f2",
      bg1: "#dcecde",
      ink: "#243d28",
      accent: "#5a8f62",
      card: "rgba(255,255,255,0.72)",
    };
  }
  // default soft paper
  return {
    bg0: "#f7f3ec",
    bg1: "#efe6d8",
    ink: "#2f2a24",
    accent: "#c2714f",
    card: "rgba(255,255,255,0.75)",
  };
}

function splitLabelValue(item: string): { label: string; value: string } {
  // "沟通566" / "面试4相关数据卡片" → label + leading number
  const m = item.match(/^(.+?)(\d[\d.,]*)(.*)$/);
  if (m) {
    const label = `${m[1]}${m[3] || ""}`.replace(/相关数据卡片$/g, "").trim() || m[1].trim();
    return { label, value: m[2] };
  }
  return { label: item.replace(/相关数据卡片$/g, "").trim() || item, value: "" };
}

/**
 * Local typographic cover — accurate Chinese text (Flux cannot reliably paint CJK).
 * Optional reference image is used as the background (cover-fit).
 * Returns a blob: URL.
 */
export async function composeTypographicCover(
  brief: CoverBrief,
  options?: {
    width?: number;
    height?: number;
    title?: string;
  },
): Promise<string> {
  const width = options?.width ?? 1080;
  const height = options?.height ?? 1440;
  const colors = parseColor(brief.color, brief.style);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布");

  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, colors.bg0);
  grad.addColorStop(1, colors.bg1);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = colors.accent + "22";
  ctx.beginPath();
  ctx.arc(width * 0.85, height * 0.12, 180, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(width * 0.12, height * 0.78, 220, 0, Math.PI * 2);
  ctx.fill();

  const pad = 72;
  let y = pad + 48;

  if (options?.title?.trim()) {
    ctx.fillStyle = colors.ink;
    ctx.font =
      '600 52px "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif';
    y = wrapText(ctx, options.title.trim(), pad, y, width - pad * 2, 64) + 36;
  }

  const items =
    brief.contentItems.length > 0
      ? brief.contentItems
      : brief.raw
          .split(/\n+/)
          .map((s) => s.trim())
          .filter((s) => s && !/^(内容|风格|颜色|画面)\s*[:：]/.test(s))
          .slice(0, 6);

  const cardH = 148;
  const gap = 28;
  for (const item of items) {
    const { label, value } = splitLabelValue(item);
    roundRect(ctx, pad, y, width - pad * 2, cardH, 28);
    ctx.fillStyle = colors.card;
    ctx.fill();
    ctx.strokeStyle = colors.accent + "33";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = colors.ink;
    ctx.font =
      '500 40px "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(label, pad + 40, y + (value ? 62 : 88));

    if (value) {
      ctx.fillStyle = colors.accent;
      ctx.font =
        '700 56px "SF Pro Display", "PingFang SC", "Helvetica Neue", sans-serif';
      const tw = ctx.measureText(value).width;
      ctx.fillText(value, width - pad - 40 - tw, y + 100);
    }

    y += cardH + gap;
    if (y > height - pad - 40) break;
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92),
  );
  if (!blob) throw new Error("封面合成失败");
  return URL.createObjectURL(blob);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  let line = "";
  for (const ch of text) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = ch;
      y += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
