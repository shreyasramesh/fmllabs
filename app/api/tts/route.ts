import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserSettings } from "@/lib/db";
import { isValidLanguageCode, type LanguageCode } from "@/lib/languages";
import { getVoiceIdForLanguage, getLanguageCodeForTts } from "@/lib/tts-voices";

const ELEVENLABS_MODEL = "eleven_flash_v2_5";
const MAX_CHARS = 5000;
const ALL_LANGUAGES = "all";

export async function POST(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TTS not configured" }, { status: 503 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const speed = typeof body.speed === "number" ? Math.max(0.7, Math.min(1.2, body.speed)) : 1;
    const language: LanguageCode = isValidLanguageCode(body.language) ? body.language : "en";
    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }
    if (text.length > MAX_CHARS) {
      return NextResponse.json(
        { error: `Text exceeds ${MAX_CHARS} characters` },
        { status: 400 }
      );
    }

    let voiceId = getVoiceIdForLanguage(language);
    const { userId } = await auth();
    if (userId) {
      const settings = await getUserSettings(userId);
      const userVoices = settings?.clonedVoices ?? [];
      const latestForLanguage = userVoices.filter((v) => v.language === language).at(-1);
      const latestForAll = userVoices.filter((v) => v.language === ALL_LANGUAGES).at(-1);
      if (latestForLanguage?.voiceId) {
        voiceId = latestForLanguage.voiceId;
      } else if (latestForAll?.voiceId) {
        voiceId = latestForAll.voiceId;
      }
    }
    const languageCode = getLanguageCodeForTts(language);

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: ELEVENLABS_MODEL,
          language_code: languageCode,
          voice_settings: { speed },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("ElevenLabs TTS error:", res.status, err);
      return NextResponse.json(
        { error: "TTS generation failed" },
        { status: 502 }
      );
    }

    const audio = await res.arrayBuffer();
    return new NextResponse(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("TTS error:", err);
    return NextResponse.json(
      { error: "TTS generation failed" },
      { status: 500 }
    );
  }
}
