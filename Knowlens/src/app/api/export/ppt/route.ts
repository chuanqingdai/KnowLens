import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import { logOpsEvent } from "@/lib/server/store";

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
const WIDE_SLIDE_WIDTH = 13.333;
const WIDE_SLIDE_HEIGHT = 7.5;
const FIRST_SLIDE_TITLE_BAND_HEIGHT = 1.02;
const FIRST_SLIDE_TITLE_PADDING_X = 0.6;
const FIRST_SLIDE_TITLE_PADDING_Y = 0.2;

async function toDataUrl(url: string) {
  if (!url.trim()) {
    throw new Error("Missing image URL");
  }
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
    const session = await getServerSession(nextAuthOptions);
    const email = session?.user?.email?.trim().toLowerCase();
    const body = (await request.json()) as ExportRequestBody;
    const slides = Array.isArray(body.slides) ? body.slides : [];

    if (!slides.length) {
      logOpsEvent({
        category: "download",
        action: "ppt_export_failed",
        status: "error",
        source: "ppt",
        userEmail: email,
        code: "PPT_EMPTY_SLIDES",
        message: "No slides provided for PPT export.",
      });
      return NextResponse.json({ error: "Slides are required for PPT export." }, { status: 400 });
    }

    const [{ default: PptxGenJS }] = await Promise.all([import("pptxgenjs")]);
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "KnowLens.ai";
    pptx.company = "KnowLens.ai";
    pptx.subject = "Knowledge Visual Deck";
    pptx.title = body.title?.trim() || "KnowLens.ai Deck";

    for (let idx = 0; idx < slides.length; idx += 1) {
      const slide = slides[idx];
      const page = pptx.addSlide();
      let imageData: string;
      try {
        const imageUrl = new URL(slide.imageSrc, request.nextUrl.origin).toString();
        imageData = await toDataUrl(imageUrl);
      } catch (downloadError) {
        const message =
          downloadError instanceof Error
            ? `Slide ${slide.page} image is not ready: ${downloadError.message}`
            : `Slide ${slide.page} image is not ready.`;
        logOpsEvent({
          category: "download",
          action: "ppt_export_image_download_failed",
          status: "error",
          source: "ppt",
          userEmail: email,
          code: "PPT_IMAGE_DOWNLOAD_FAILED",
          message,
        });
        throw new Error(message);
      }

      page.addImage({
        data: imageData,
        x: 0,
        y: 0,
        w: WIDE_SLIDE_WIDTH,
        h: WIDE_SLIDE_HEIGHT,
        sizing: {
          type: "cover",
          x: 0,
          y: 0,
          w: WIDE_SLIDE_WIDTH,
          h: WIDE_SLIDE_HEIGHT,
        },
      });

      if (idx === 0) {
        const titleText = slide.title?.trim() || body.title?.trim() || "KnowLens.ai";
        page.addShape(pptx.ShapeType.rect, {
          x: 0,
          y: 0,
          w: WIDE_SLIDE_WIDTH,
          h: FIRST_SLIDE_TITLE_BAND_HEIGHT,
          fill: {
            color: "111827",
            transparency: 30,
          },
          line: {
            color: "111827",
            transparency: 100,
          },
        });
        page.addText(titleText, {
          x: FIRST_SLIDE_TITLE_PADDING_X,
          y: FIRST_SLIDE_TITLE_PADDING_Y,
          w: WIDE_SLIDE_WIDTH - FIRST_SLIDE_TITLE_PADDING_X * 2,
          h: FIRST_SLIDE_TITLE_BAND_HEIGHT - FIRST_SLIDE_TITLE_PADDING_Y,
          fontFace: "Calibri",
          fontSize: 28,
          bold: true,
          color: "FFFFFF",
          valign: "middle",
          align: "left",
          fit: "shrink",
        });
      }
    }

    const buffer = (await pptx.write({
      outputType: "nodebuffer",
    })) as Buffer;
    const responseBody = new Uint8Array(buffer);
    logOpsEvent({
      category: "download",
      action: "ppt_export_success",
      status: "ok",
      source: "ppt",
      userEmail: email,
      message: `slides:${slides.length}`,
    });

    return new NextResponse(responseBody, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition":
          "attachment; filename*=UTF-8''KnowLens.ai-visual-deck.pptx",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PPT 生成失败";
    logOpsEvent({
      category: "download",
      action: "ppt_export_failed",
      status: "error",
      source: "ppt",
      code: "PPT_EXPORT_INTERNAL",
      message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
