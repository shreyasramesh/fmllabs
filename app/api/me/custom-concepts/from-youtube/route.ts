import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateConceptsFromTranscript } from "@/lib/gemini";
import { getLanguageName, isValidLanguageCode } from "@/lib/languages";
import {
  getSavedTranscript,
  saveTranscript,
  updateTranscriptExtractedConcepts,
} from "@/lib/db";
import { recordUsageEvent, computeTranscribrCost, recordMongoUsageRequest } from "@/lib/usage";

function extractVideoId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  const patterns = [
    /(?:youtu\.be\/|v\/|embed\/|watch\?v=|\&v=)([\w-]{11})/,
    /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m && m[1] && m[1].length === 11) return m[1];
  }
  return null;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.TRANSCRIBR_API_KEY?.trim();
  recordMongoUsageRequest(userId).catch(() => {});
  try {
    const body = await request.json().catch(() => ({}));
    const transcriptId = typeof body.transcriptId === "string" ? body.transcriptId.trim() : null;
    const extractPrompt = typeof body.extractPrompt === "string" ? body.extractPrompt.trim() : undefined;
    const languageCode = typeof body.language === "string" && isValidLanguageCode(body.language)
      ? body.language
      : "en";
    const languageName = getLanguageName(languageCode);

    let transcriptText: string;
    let videoId: string;
    let videoTitle: string | null = null;
    let channel: string | null = null;
    let savedTranscriptId: string | null = transcriptId;

    if (transcriptId) {
      const saved = await getSavedTranscript(transcriptId, userId);
      if (!saved) {
        return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
      }
      transcriptText = saved.transcriptText;
      videoId = saved.videoId;
      videoTitle = saved.videoTitle ?? null;
      channel = saved.channel ?? null;
    } else {
      if (!apiKey) {
        return NextResponse.json(
          { error: "TRANSCRIBR_API_KEY is not configured" },
          { status: 500 }
        );
      }
      const urlOrId = (body.url ?? body.videoId ?? body.video_id ?? "") as string;
      const extractedVideoId = typeof urlOrId === "string" ? extractVideoId(urlOrId) : null;
      if (!extractedVideoId) {
        return NextResponse.json(
          { error: "Valid YouTube URL or video ID is required" },
          { status: 400 }
        );
      }
      videoId = extractedVideoId;

      const transcriptRes = await fetch("https://www.transcribr.io/api/v1/transcript", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({ video_id: videoId }),
      });

      if (!transcriptRes.ok) {
        const errText = await transcriptRes.text();
        let message = "Failed to fetch transcript";
        try {
          const errJson = JSON.parse(errText);
          if (errJson.error) message = errJson.error;
        } catch {
          /* ignore */
        }
        return NextResponse.json({ error: message }, { status: transcriptRes.status });
      }

      const transcriptData = (await transcriptRes.json()) as {
        text?: string;
        title?: string;
        channel?: string;
        transcript?: { text?: string }[];
      };

      transcriptText =
        transcriptData.text ??
        (Array.isArray(transcriptData.transcript)
          ? transcriptData.transcript.map((s) => s.text ?? "").join(" ")
          : "");

      if (!transcriptText || !transcriptText.trim()) {
        return NextResponse.json(
          { error: "No transcript available for this video" },
          { status: 400 }
        );
      }

      videoTitle = transcriptData.title ?? null;
      channel = transcriptData.channel ?? null;

      const saved = await saveTranscript(userId, videoId, transcriptText, videoTitle ?? undefined, channel ?? undefined);
      savedTranscriptId = saved._id;
      await recordUsageEvent({
        userId,
        service: "transcribr",
        eventType: "transcript_fetch",
        costUsd: computeTranscribrCost(),
        metadata: { videoId },
      });
    }

    const { groups } = await generateConceptsFromTranscript(
      transcriptText,
      videoTitle ?? undefined,
      channel ?? undefined,
      languageName,
      extractPrompt || undefined,
      { userId, eventType: "from_youtube" }
    );

    if (savedTranscriptId) {
      await updateTranscriptExtractedConcepts(savedTranscriptId, userId, groups);
    }

    return NextResponse.json({
      videoId,
      videoTitle,
      channel,
      groups,
    });
  } catch (err) {
    console.error("Failed to extract concepts from YouTube:", err);
    return NextResponse.json(
      { error: "Failed to extract concepts from YouTube" },
      { status: 500 }
    );
  }
}
