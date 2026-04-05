import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCustomConcepts, createCustomConcept } from "@/lib/db";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 120, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);
  try {
    const items = await getCustomConcepts(userId);
    return NextResponse.json(items);
  } catch (err) {
    console.error("Failed to fetch custom concepts:", err);
    return NextResponse.json(
      { error: "Failed to fetch custom concepts" },
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
    const title = body.title as string | undefined;
    const summary = body.summary as string | undefined;
    const enrichmentPrompt = body.enrichmentPrompt as string | undefined;
    if (
      !title ||
      typeof title !== "string" ||
      !summary ||
      typeof summary !== "string" ||
      !enrichmentPrompt ||
      typeof enrichmentPrompt !== "string"
    ) {
      return NextResponse.json(
        { error: "title, summary, and enrichmentPrompt are required" },
        { status: 400 }
      );
    }
    const concept = await createCustomConcept(
      userId,
      title.trim(),
      summary.trim(),
      enrichmentPrompt.trim()
    );
    return NextResponse.json(concept);
  } catch (err) {
    console.error("Failed to create custom concept:", err);
    return NextResponse.json(
      { error: "Failed to create custom concept" },
      { status: 500 }
    );
  }
}
