import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSavedConcepts, addSavedConcept } from "@/lib/db";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 120, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  try {
    const concepts = await getSavedConcepts(userId);
    return NextResponse.json(concepts);
  } catch (err) {
    console.error("Failed to fetch saved concepts:", err);
    return NextResponse.json(
      { error: "Failed to fetch concepts" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const modelId = body.modelId as string | undefined;
    const reflection = body.reflection as string | undefined;
    if (!modelId || typeof modelId !== "string") {
      return NextResponse.json(
        { error: "modelId required" },
        { status: 400 }
      );
    }
    await addSavedConcept(userId, modelId, reflection);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to add saved concept:", err);
    return NextResponse.json(
      { error: "Failed to add concept" },
      { status: 500 }
    );
  }
}
