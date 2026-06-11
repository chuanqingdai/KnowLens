import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { nextAuthOptions } from "@/lib/nextAuth";
import {
  getImageGenerationTaskWithJob,
  readImageAsset,
} from "@/lib/server/image-generation-jobs";
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

function extractWorkspaceAssetTaskId(url: string, origin: string) {
  try {
    const parsed = new URL(url, origin);
    const match = parsed.pathname.match(/^\/api\/workspace\/image\/assets\/([^/]+)$/);
    return match?.[1] ? decodeURIComponent(match[1]) : "";
  } catch {
    return "";
  }
}

async function toDataUrl(url: string, origin: string, userEmail?: string | null) {
  if (!url.trim()) {
    throw new Error("Missing image URL");
  }
  const taskId = extractWorkspaceAssetTaskId(url, origin);
  if (taskId) {
    const taskWithJob = await getImageGenerationTaskWithJob(taskId);
    if (!taskWithJob) {
      throw new Error("Image asset was not found");
    }
    if (userEmail && taskWithJob.job.userEmail.trim().toLowerCase() !== userEmail) {
      throw new Error("Image asset is not available for this account");
    }
    const asset = await readImageAsset(taskId);
    if (!asset) {
      throw new Error("Image asset is not available");
    }
    if (asset.redirectUrl) {
      return toDataUrl(asset.redirectUrl, origin, userEmail);
    }
    if (!asset.bytes) {
      throw new Error("Image asset is not ready");
    }
    return `data:${asset.mimeType || "image/png"};base64,${asset.bytes.toString("base64")}`;
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Image download failed");
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
        imageData = await toDataUrl(imageUrl, request.nextUrl.origin, email);
      } catch (downloadError) {
        const message =
          downloadError instanceof Error
            ? `Slide ${slide.page} image could not be prepared: ${downloadError.message}`
            : `Slide ${slide.page} image could not be prepared.`;
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
    const message = error instanceof Error ? error.message : "PPT export failed";
    const code = /image/i.test(message) ? "PPT_IMAGE_DOWNLOAD_FAILED" : "PPT_EXPORT_INTERNAL";
    logOpsEvent({
      category: "download",
      action: "ppt_export_failed",
      status: "error",
      source: "ppt",
      code,
      message,
    });
    return NextResponse.json({ error: message, code }, { status: 500 });
  }
}
