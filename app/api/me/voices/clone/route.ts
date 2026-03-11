import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { upsertUserSettings } from "@/lib/db";

/**
 * Voice cloning: audio files are streamed to ElevenLabs and never persisted.
 * We only store the returned voice_id (and display name) in user settings.
 */
const MAX_FILE_SIZE_MB = 25;
const MAX_FILES = 6;
const ALLOWED_EXT = [".mp3", ".wav", ".webm", ".ogg"];

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Voice cloning not configured" }, { status: 503 });
  }

  try {
    const formData = await request.formData();
    const name = formData.get("name");
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
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

    await upsertUserSettings(userId, {
      clonedVoiceId: voiceId,
      clonedVoiceName: name.trim(),
    });

    return NextResponse.json({
      voice_id: voiceId,
      name: name.trim(),
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
export async function DELETE() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await upsertUserSettings(userId, {
      clonedVoiceId: undefined,
      clonedVoiceName: undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Remove clone error:", err);
    return NextResponse.json({ error: "Failed to remove voice" }, { status: 500 });
  }
}
