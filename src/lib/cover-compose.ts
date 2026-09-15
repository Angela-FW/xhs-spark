/** Parse structured cover briefs like 内容/风格/颜色. */

export type CoverBrief = {
  raw: string;
  contentItems: string[];
  style: string;
  color: string;
  /** User clearly wants readable text on the cover. */
  wantsText: boolean;
};

export type CoverTextRequest = {
  wantsText: boolean;
  lines: string[];
};

const WANT_TEXT_RE =
  /加文字|配文字|叠字|叠文字|封面写|写上字|带字|放文字|加上文字|图片上文字|图上文字|标题文字|写上标题|加上标题|用标题|把标题|写上「|写上“|写上"|文字\s*[:：]|内容\s*[:：]|文案\s*[:：]/;

const PLAIN_BG_RE = /素色|纯色|纯背景|留白|扁平|信息图|数据卡片|卡片式/;
const PHOTO_SCENE_RE =
  /人像|自拍|写真|摄影|照片|实拍|静物|桌面|咖啡|窗光|房间|厨房|妆面|口红|通勤|地铁/;

/** Only when the user prompt explicitly asks to put words on the cover. */
export function extractCoverTextRequest(
  userPrompt: string,
  fallbackTitle = "",
): CoverTextRequest {
  const raw = userPrompt.trim();
  if (!raw) return { wantsText: false, lines: [] };

  const fieldText =
    matchField(raw, "内容") ||
    matchField(raw, "文案") ||
    matchField(raw, "文字");
  const fieldItems = splitContentLines(fieldText);

  const quoted: string[] = [];
  for (const re of [
    /[「『]([^」』]{1,40})[」』]/g,
    /[“"]([^”"]{1,40})[”"]/g,
  ]) {
    for (const m of raw.matchAll(re)) {
      const t = m[1]?.trim();
      if (t) quoted.push(t);
    }
  }

  const afterVerb = raw.match(
    /(?:写上|叠上|带上)(?:文字|字)?\s*[:：]?\s*([^\n]{1,40})/,
  );
  const afterCoverWrite = raw.match(
    /封面写(?:上|字)?\s*[:：]?\s*([^\n]{1,40})/,
  );
  let verbText = (afterVerb?.[1] || afterCoverWrite?.[1] || "").trim();
  verbText = verbText.replace(/^[「『“"]|[」』”"]$/g, "").trim();
  if (/^(文字|字|标题)$/.test(verbText)) verbText = "";

  const wantsTitle = /写上标题|加上标题|用标题|把标题|标题文字/.test(raw);
  const wantsText =
    fieldItems.length > 0 ||
    Boolean(fieldText) ||
    quoted.length > 0 ||
    Boolean(verbText) ||
    wantsTitle ||
    WANT_TEXT_RE.test(raw);

  if (!wantsText) return { wantsText: false, lines: [] };

  const lines: string[] = [];
  const push = (value: string) => {
    const t = value.replace(/\s+/g, " ").trim();
    if (!t || /^(文字|字|标题)$/.test(t)) return;
    const clipped = t.length > 80 ? t.slice(0, 80) : t;
    if (!lines.includes(clipped)) lines.push(clipped);
  };

  for (const item of fieldItems) push(item);
  if (!fieldItems.length && fieldText) push(fieldText);
  for (const item of quoted) push(item);
  if (verbText) push(verbText);
  if (wantsTitle && fallbackTitle.trim()) push(fallbackTitle.trim());

  return { wantsText: true, lines: lines.slice(0, 3) };
}

export function parseCoverBrief(prompt: string): CoverBrief {
  const raw = prompt.trim();
  const content =
    matchField(raw, "内容") ||
    matchField(raw, "文案") ||
    matchField(raw, "文字");
  const style = matchField(raw, "风格") || matchField(raw, "样式") || "";
  const color =
    matchField(raw, "颜色") || matchField(raw, "配色") || inferColorLabel(raw);
  const textReq = extractCoverTextRequest(raw);
  const contentItems = splitItems(content);
  return {
    raw,
    contentItems: contentItems.length > 0 ? contentItems : textReq.lines,
    style,
    color,
    wantsText: textReq.wantsText,
  };
}

/**
 * Solid-color / infographic covers: typeset locally.
 * Kolors cannot paint accurate Chinese, and sending "沟通356" upstream often 500s.
 */
export function shouldUseLocalTypographicCover(prompt: string): boolean {
  const brief = parseCoverBrief(prompt);
  if (!brief.wantsText || brief.contentItems.length === 0) return false;
  const raw = brief.raw;
  const plain = PLAIN_BG_RE.test(raw) || /背景/.test(raw);
  const photo = PHOTO_SCENE_RE.test(raw);
  if (plain && !photo) return true;
  return PLAIN_BG_RE.test(raw);
}

function inferColorLabel(raw: string): string {
  if (/浅紫|淡紫|薰衣草|紫/.test(raw)) return "淡紫";
  if (/粉|玫瑰/.test(raw)) return "粉";
  if (/蓝/.test(raw)) return "蓝";
  if (/珊瑚|橙|暖/.test(raw)) return "暖橙";
  if (/绿/.test(raw)) return "绿";
  if (/米白|米色|奶油|纸色/.test(raw)) return "米色";
  return "";
}

function matchField(text: string, label: string): string {
  const re = new RegExp(
    `${label}\\s*[:：]\\s*([^\\n]*)`,
    "i",
  );
  const m = text.match(re);
  if (!m) return "";
  let value = (m[1] || "").trim();
  if (!value) {
    const after = text.slice((m.index ?? 0) + m[0].length);
    const next = after.match(/^\s*\n+\s*([^\n]+)/);
    value = next?.[1]?.trim() || "";
  }
  return value
    .replace(/\s*(?:风格|样式|颜色|配色|画面)\s*[:：].*$/u, "")
    .trim();
}

function splitContentLines(value: string): string[] {
  const t = value.trim();
  if (!t) return [];
  if (/[,，、;；|/]/.test(t) && t.length <= 80) {
    return splitItems(t);
  }
  return [t];
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
  if (/浅紫|淡紫|薰衣草|紫/.test(blob)) {
    return {
      bg0: "#f3eef8",
      bg1: "#e4d7f0",
      ink: "#3d2a52",
      accent: "#8b6bb0",
      card: "rgba(255,255,255,0.72)",
    };
  }
  if (/粉|玫瑰/.test(blob)) {
    return {
      bg0: "#f8eef3",
      bg1: "#f0d9e4",
      ink: "#4a2a38",
      accent: "#c46b8a",
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

/** Typographic covers honor 居中 / 靠上 / 靠下; default to vertical center. */
export function inferCoverBlockAlign(raw: string): "top" | "center" | "bottom" {
  const t = raw.replace(/\s+/g, "");
  if (/不居中/.test(t)) return "top";
  if (/居中|垂直居中|上下居中|中间/.test(t)) return "center";
  if (/靠下|底部|底端|下方对齐/.test(t)) return "bottom";
  if (/靠上|顶部|顶端|上方对齐/.test(t)) return "top";
  return "center";
}

function blockStartY(
  height: number,
  pad: number,
  blockH: number,
  align: "top" | "center" | "bottom",
): number {
  if (align === "center") return Math.max(pad, Math.round((height - blockH) / 2));
  if (align === "bottom") return Math.max(pad, height - pad - blockH);
  return pad + 48;
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
 * Local typographic cover — accurate Chinese text (we overlay instead of asking the model to paint CJK).
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
  const fontStack =
    '"PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif';
  const title = options?.title?.trim() ?? "";
  ctx.font = `600 52px ${fontStack}`;
  const titleLines = title ? wrapLines(ctx, title, width - pad * 2).slice(0, 3) : [];
  const titleLineH = 64;
  const titleGap = titleLines.length ? 36 : 0;

  const items = (
    brief.contentItems.length > 0
      ? brief.contentItems
      : brief.raw
          .split(/\n+/)
          .map((s) => s.trim())
          .filter((s) => s && !/^(内容|风格|颜色|画面)\s*[:：]/.test(s))
  ).slice(0, 6);

  const cardH = 148;
  const gap = 28;
  const titleH = titleLines.length * titleLineH + titleGap;
  const maxCards = Math.max(
    1,
    Math.floor((height - pad * 2 - titleH + gap) / (cardH + gap)),
  );
  const visible = items.slice(0, maxCards);
  const cardsH =
    visible.length * cardH + Math.max(0, visible.length - 1) * gap;
  const blockH = titleH + cardsH;
  let y = blockStartY(height, pad, blockH, inferCoverBlockAlign(brief.raw));

  if (titleLines.length) {
    ctx.fillStyle = colors.ink;
    ctx.textBaseline = "top";
    ctx.font = `600 52px ${fontStack}`;
    for (const line of titleLines) {
      ctx.fillText(line, pad, y);
      y += titleLineH;
    }
    y += titleGap;
    ctx.textBaseline = "alphabetic";
  }

  for (const item of visible) {
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
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92),
  );
  if (!blob) throw new Error("封面合成失败");
  return URL.createObjectURL(blob);
}

const NOTE_COVER_WIDTH = 1080;
const NOTE_COVER_HEIGHT = 1440;

/** Center-crop / scale any generated image to Xiaohongshu 3:4 (1080×1440). */
export async function fitCoverToNoteSize(imageUrl: string): Promise<string> {
  const width = NOTE_COVER_WIDTH;
  const height = NOTE_COVER_HEIGHT;
  const bitmap = await bitmapFromUrl(imageUrl);
  try {
    if (bitmap.width === width && bitmap.height === height) return imageUrl;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建画布");

    const scale = Math.max(width / bitmap.width, height / bitmap.height);
    const dw = bitmap.width * scale;
    const dh = bitmap.height * scale;
    ctx.drawImage(bitmap, (width - dw) / 2, (height - dh) / 2, dw, dh);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (!blob) throw new Error("封面裁切失败");
    if (imageUrl.startsWith("blob:")) URL.revokeObjectURL(imageUrl);
    return URL.createObjectURL(blob);
  } finally {
    bitmap.close();
  }
}

/**
 * Draw user-requested Chinese onto a generated photo.
 * Cover titles stay locally typeset; we overlay only when the user asked for text.
 */
export async function overlayCoverText(
  imageUrl: string,
  lines: string[],
  options?: {
    width?: number;
    height?: number;
  },
): Promise<string> {
  const cleaned = lines
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 3);
  if (!cleaned.length) return imageUrl;

  const width = options?.width ?? 1080;
  const height = options?.height ?? 1440;
  const bitmap = await bitmapFromUrl(imageUrl);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("无法创建画布");
  }

  const scale = Math.max(width / bitmap.width, height / bitmap.height);
  const dw = bitmap.width * scale;
  const dh = bitmap.height * scale;
  ctx.drawImage(bitmap, (width - dw) / 2, (height - dh) / 2, dw, dh);
  bitmap.close();

  const fadeH = Math.round(height * 0.42);
  const fade = ctx.createLinearGradient(0, height - fadeH, 0, height);
  fade.addColorStop(0, "rgba(28, 22, 18, 0)");
  fade.addColorStop(0.45, "rgba(28, 22, 18, 0.35)");
  fade.addColorStop(1, "rgba(28, 22, 18, 0.72)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, height - fadeH, width, fadeH);

  const pad = 72;
  const [main, ...rest] = cleaned;
  const sub = rest.join(" · ");
  const fontStack =
    '"PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif';

  ctx.fillStyle = "#fffaf6";
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 2;
  ctx.textBaseline = "alphabetic";

  ctx.font = `600 64px ${fontStack}`;
  const mainLines = wrapLines(ctx, main, width - pad * 2).slice(0, 3);
  ctx.font = `500 36px ${fontStack}`;
  const subLines = sub ? wrapLines(ctx, sub.slice(0, 28), width - pad * 2).slice(0, 1) : [];

  const mainLh = 76;
  const subLh = 48;
  const blockH =
    mainLines.length * mainLh + (subLines.length ? 16 + subLines.length * subLh : 0);
  let y = height - pad - blockH + 56;

  ctx.font = `600 64px ${fontStack}`;
  ctx.fillStyle = "#fffaf6";
  for (const line of mainLines) {
    ctx.fillText(line, pad, y);
    y += mainLh;
  }
  if (subLines.length) {
    y += 8;
    ctx.font = `500 36px ${fontStack}`;
    ctx.fillStyle = "rgba(255,250,246,0.88)";
    for (const line of subLines) {
      ctx.fillText(line, pad, y);
      y += subLh;
    }
  }

  ctx.shadowColor = "transparent";

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92),
  );
  if (!blob) throw new Error("封面叠字失败");
  return URL.createObjectURL(blob);
}

async function bitmapFromUrl(url: string): Promise<ImageBitmap> {
  const res = await fetch(url);
  const blob = await res.blob();
  return createImageBitmap(blob);
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const ch of text) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
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
