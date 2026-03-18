import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { recordUsageEvent, computeSttCost } from "@/lib/usage";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    const body = await request.json().catch(() => ({}));
    const durationSeconds = typeof body.durationSeconds === "number" ? body.durationSeconds : 0;
    if (durationSeconds <= 0) {
      return NextResponse.json({ error: "durationSeconds required" }, { status: 400 });
    }
    const costUsd = computeSttCost(durationSeconds);
    await recordUsageEvent({
      userId: userId ?? null,
      service: "elevenlabs_stt",
      eventType: "stt_session",
      costUsd,
      metadata: { durationSeconds },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("STT usage recording failed:", err);
    return NextResponse.json(
      { error: "Failed to record usage" },
      { status: 500 }
    );
  }
}
