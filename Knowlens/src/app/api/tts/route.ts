import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const VOICE_WHITELIST = new Set(["Ting-Ting", "Samantha", "Daniel"]);
const MAX_TEXT_LEN = 600;

export const runtime = "nodejs";

type TtsPayload = {
  text?: string;
  voice?: string;
};

async function safeUnlink(filePath: string) {
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore
  }
}

export async function POST(request: Request) {
  let aiffPath = "";
  let wavPath = "";
  try {
    const payload = (await request.json()) as TtsPayload;
    const text = (payload.text ?? "").trim();
    const voice = payload.voice && VOICE_WHITELIST.has(payload.voice)
      ? payload.voice
      : "Ting-Ting";

    if (!text) {
      return new Response("text is required", { status: 400 });
    }

    if (text.length > MAX_TEXT_LEN) {
      return new Response("text is too long", { status: 400 });
    }

    const basename = `scilens-tts-${randomUUID()}`;
    aiffPath = path.join(os.tmpdir(), `${basename}.aiff`);
    wavPath = path.join(os.tmpdir(), `${basename}.wav`);

    await execFileAsync("/usr/bin/say", ["-v", voice, "-o", aiffPath, text]);
    await execFileAsync("/usr/bin/afconvert", [
      "-f",
      "WAVE",
      "-d",
      "LEI16@48000",
      aiffPath,
      wavPath,
    ]);

    const data = await fs.readFile(wavPath);
    return new Response(data, {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown tts error";
    return new Response(message, { status: 500 });
  } finally {
    if (aiffPath) {
      await safeUnlink(aiffPath);
    }
    if (wavPath) {
      await safeUnlink(wavPath);
    }
  }
}
