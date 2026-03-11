import { NextResponse } from "next/server";

/**
 * Creates a single-use token for ElevenLabs Scribe v2 realtime speech-to-text.
 * Token expires in ~15 minutes and is consumed on first use.
 * Use tokens for client-side WebSocket connections to avoid exposing the API key.
 */
export async function POST() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "STT not configured" }, { status: 503 });
  }

  try {
    const res = await fetch(
      "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe",
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("ElevenLabs STT token error:", res.status, err);
      return NextResponse.json(
        { error: "Failed to create STT token" },
        { status: 502 }
      );
    }

    const { token } = (await res.json()) as { token: string };
    if (!token) {
      return NextResponse.json(
        { error: "Invalid token response" },
        { status: 502 }
      );
    }

    return NextResponse.json({ token });
  } catch (err) {
    console.error("STT token error:", err);
    return NextResponse.json(
      { error: "Failed to create STT token" },
      { status: 500 }
    );
  }
}
