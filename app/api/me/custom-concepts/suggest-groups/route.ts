import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { suggestGroupsForConcept } from "@/lib/gemini";

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
    const groups = body.groups as { id: string; title: string }[] | undefined;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 }
      );
    }

    const validGroups = Array.isArray(groups)
      ? groups.filter(
          (g) =>
            g &&
            typeof g.id === "string" &&
            typeof g.title === "string" &&
            g.id.trim() &&
            g.title.trim()
        )
      : [];

    const result = await suggestGroupsForConcept(
      {
        title: title.trim(),
        summary: (summary ?? "").trim(),
        enrichmentPrompt: (enrichmentPrompt ?? "").trim(),
      },
      validGroups.map((g) => ({ id: g.id.trim(), title: g.title.trim() }))
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error("Failed to suggest groups for concept:", err);
    return NextResponse.json(
      { error: "Failed to suggest groups" },
      { status: 500 }
    );
  }
}
