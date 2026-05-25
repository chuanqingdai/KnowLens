import { NextRequest, NextResponse } from "next/server";

type ExportSlidePayload = {
  page: number;
  title: string;
  body: string;
  imageSrc: string;
};

type ExportRequestBody = {
  title?: string;
  slides?: ExportSlidePayload[];
};

export const runtime = "nodejs";

async function toDataUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("图片下载失败");
  }
  const contentType = response.headers.get("content-type") ?? "image/png";
  const buffer = Buffer.from(await response.arrayBuffer());
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ExportRequestBody;
    const slides = Array.isArray(body.slides) ? body.slides : [];

    if (!slides.length) {
      return NextResponse.json({ error: "缺少分镜内容" }, { status: 400 });
    }

    const [{ default: PptxGenJS }] = await Promise.all([import("pptxgenjs")]);
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "KnowLens.ai";
    pptx.company = "KnowLens.ai";
    pptx.subject = "科普内容生成";
    pptx.title = body.title?.trim() || "KnowLens.ai 内容草稿";

    for (const slide of slides) {
      const page = pptx.addSlide();
      page.background = { color: "F8F8F8" };

      page.addText(`第${slide.page}页`, {
        x: 0.4,
        y: 0.2,
        w: 2,
        h: 0.3,
        fontFace: "Calibri",
        fontSize: 12,
        color: "6B7280",
      });

      page.addText(slide.title || "未命名分镜", {
        x: 0.4,
        y: 0.48,
        w: 12.4,
        h: 0.48,
        fontFace: "Calibri",
        fontSize: 25,
        color: "111827",
        bold: true,
      });

      const imageUrl = new URL(slide.imageSrc, request.nextUrl.origin).toString();
      const imageData = await toDataUrl(imageUrl);
      page.addImage({
        data: imageData,
        x: 0.55,
        y: 1.08,
        w: 12.2,
        h: 5.6,
        sizing: { type: "cover", x: 0.55, y: 1.08, w: 12.2, h: 5.6 },
      });

      page.addShape(pptx.ShapeType.rect, {
        x: 0.55,
        y: 6.84,
        w: 12.2,
        h: 0.78,
        fill: { color: "FFFFFF", transparency: 6 },
        line: { color: "E5E7EB", pt: 1 },
      });

      page.addText(slide.body || "（此页暂无旁白文案）", {
        x: 0.72,
        y: 6.98,
        w: 11.85,
        h: 0.45,
        fontFace: "Calibri",
        fontSize: 13,
        color: "374151",
      });
    }

    const buffer = (await pptx.write({
      outputType: "nodebuffer",
    })) as Buffer;
    const responseBody = new Uint8Array(buffer);

    return new NextResponse(responseBody, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition":
          "attachment; filename*=UTF-8''KnowLens.ai-%E7%A7%91%E6%99%AE%E5%88%86%E9%95%9C-PPT%E7%89%88.pptx",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PPT 生成失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
