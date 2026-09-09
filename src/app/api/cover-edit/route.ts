import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Proxy Pollinations image edits to avoid browser CORS issues
 * when uploading a local reference photo for img2img covers.
 */
export async function POST(req: NextRequest) {
  try {
    const incoming = await req.formData();
    const image = incoming.get("image");
    const prompt = String(incoming.get("prompt") ?? "");
    const model = String(incoming.get("model") ?? "kontext");
    const size = String(incoming.get("size") ?? "1080x1440");
    const seed = incoming.get("seed");
    const key = req.headers.get("x-pollinations-key") || "";

    if (!image || !(image instanceof Blob) || !prompt) {
      return NextResponse.json(
        { error: "需要 image 与 prompt" },
        { status: 400 },
      );
    }

    const form = new FormData();
    form.append(
      "image",
      image,
      image instanceof File ? image.name : "reference.jpg",
    );
    form.append("prompt", prompt);
    form.append("model", model);
    form.append("size", size);
    if (seed != null && String(seed)) form.append("seed", String(seed));

    const headers: HeadersInit = {};
    if (key) headers.Authorization = `Bearer ${key}`;

    const upstream = await fetch("https://gen.pollinations.ai/v1/images/edits", {
      method: "POST",
      headers,
      body: form,
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return NextResponse.json(
        {
          error: `上游失败 ${upstream.status}`,
          detail: text.slice(0, 300),
        },
        { status: upstream.status },
      );
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    if (contentType.includes("application/json")) {
      const json = await upstream.json();
      return NextResponse.json(json);
    }

    const buf = await upstream.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "代理失败",
      },
      { status: 500 },
    );
  }
}
