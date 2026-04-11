import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { transcribeNutritionImage } from "@/lib/gemini";
import { recordMongoUsageRequest } from "@/lib/usage";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function estimateBase64Bytes(value: string): number {
  const noPadding = value.replace(/=+$/, "");
  return Math.floor((noPadding.length * 3) / 4);
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 15, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  recordMongoUsageRequest(userId).catch(() => {});

  try {
    const body = (await request.json().catch(() => ({}))) as {
      imageBase64?: unknown;
      mimeType?: unknown;
      hintText?: unknown;
      mode?: unknown;
    };
    const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64.trim() : "";
    const mimeType = typeof body.mimeType === "string" ? body.mimeType.trim().toLowerCase() : "";
    const hintText = typeof body.hintText === "string" ? body.hintText : "";
    const mode =
      body.mode === "exercise" || body.mode === "auto"
        ? body.mode
        : "nutrition";

    if (!imageBase64) {
      return NextResponse.json({ error: "Image is required" }, { status: 400 });
    }
    if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
    }
    if (estimateBase64Bytes(imageBase64) > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image is too large (max 5MB)" }, { status: 400 });
    }

    const transcription = await transcribeNutritionImage(
      { imageBase64, mimeType, hintText, mode },
      { userId, eventType: "calorie_journal_image_transcribe" }
    );
    return NextResponse.json(transcription);
  } catch (err) {
    console.error("Calorie image transcription error:", err);
    return NextResponse.json(
      { error: "Failed to transcribe image" },
      { status: 500 }
    );
  }
}
