import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserSettings, upsertUserSettings } from "@/lib/db";
import { isValidLanguageCode } from "@/lib/languages";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

/**
 * Voice cloning: audio files are streamed to ElevenLabs and never persisted.
 * We only store returned voice metadata (id, name, language) in user settings.
 */
const MAX_FILE_SIZE_MB = 25;
const MAX_FILES = 6;
const ALLOWED_EXT = [".mp3", ".wav", ".webm", ".ogg"];
const ALL_LANGUAGES = "all";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 15, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Voice cloning not configured" }, { status: 503 });
  }

  try {
    const formData = await request.formData();
    const name = formData.get("name");
    const rawLanguage = formData.get("language");
    const language =
      typeof rawLanguage === "string" && rawLanguage.trim()
        ? rawLanguage.trim().toLowerCase()
        : ALL_LANGUAGES;
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (language !== ALL_LANGUAGES && !isValidLanguageCode(language)) {
      return NextResponse.json({ error: "valid language is required" }, { status: 400 });
    }

    const files: File[] = [];
    const fileEntries = formData.getAll("files");
    if (!Array.isArray(fileEntries) || fileEntries.length === 0) {
      return NextResponse.json({ error: "At least one audio file is required" }, { status: 400 });
    }
    for (const entry of fileEntries) {
      if (entry instanceof File && entry.size > 0) {
        files.push(entry);
      }
    }
    if (files.length === 0) {
      return NextResponse.json({ error: "No valid audio files provided" }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Maximum ${MAX_FILES} files allowed` }, { status: 400 });
    }

    const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
    for (const f of files) {
      if (f.size > maxBytes) {
        return NextResponse.json(
          { error: `File "${f.name}" exceeds ${MAX_FILE_SIZE_MB}MB limit` },
          { status: 400 }
        );
      }
      const ext = "." + (f.name.split(".").pop() ?? "").toLowerCase();
      if (!ALLOWED_EXT.includes(ext)) {
        return NextResponse.json(
          { error: `File "${f.name}": use MP3, WAV, WebM, or OGG.` },
          { status: 400 }
        );
      }
    }

    const body = new FormData();
    body.append("name", name.trim());
    for (const file of files) {
      body.append("files", file);
    }

    const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body,
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("ElevenLabs voice clone error:", res.status, err);
      return NextResponse.json(
        { error: "Voice cloning failed. Try cleaner audio or a different format." },
        { status: 502 }
      );
    }

    const data = (await res.json()) as { voice_id?: string; requires_verification?: boolean };
    const voiceId = data?.voice_id;
    if (!voiceId || typeof voiceId !== "string") {
      return NextResponse.json(
        { error: "Invalid response from voice service" },
        { status: 502 }
      );
    }

    const existing = await getUserSettings(userId);
    const currentVoices = Array.isArray(existing?.clonedVoices) ? existing.clonedVoices : [];
    // Keep all user-created clones; dedupe exact same voice id entries.
    const nextVoices = [
      ...currentVoices.filter((v) => !(v.voiceId === voiceId && v.language === language)),
      { voiceId, name: name.trim(), language },
    ];
    await upsertUserSettings(userId, { clonedVoices: nextVoices });

    return NextResponse.json({
      voice_id: voiceId,
      name: name.trim(),
      language,
      requires_verification: !!data.requires_verification,
    });
  } catch (err) {
    console.error("Voice clone error:", err);
    return NextResponse.json(
      { error: "Voice cloning failed" },
      { status: 500 }
    );
  }
}

/** Remove cloned voice from user settings (voice remains in ElevenLabs). */
export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const voiceId = url.searchParams.get("voiceId");
    const languageParam = url.searchParams.get("language");
    const language = languageParam?.toLowerCase();
    const existing = await getUserSettings(userId);
    const currentVoices = Array.isArray(existing?.clonedVoices) ? existing.clonedVoices : [];

    let nextVoices = currentVoices;
    if (voiceId && language) {
      nextVoices = currentVoices.filter((v) => !(v.voiceId === voiceId && v.language === language));
    } else if (voiceId) {
      nextVoices = currentVoices.filter((v) => v.voiceId !== voiceId);
    } else if (language && (language === ALL_LANGUAGES || isValidLanguageCode(language))) {
      nextVoices = currentVoices.filter((v) => v.language !== language);
    } else {
      nextVoices = [];
    }

    await upsertUserSettings(userId, { clonedVoices: nextVoices });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Remove clone error:", err);
    return NextResponse.json({ error: "Failed to remove voice" }, { status: 500 });
  }
}
