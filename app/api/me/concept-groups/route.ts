import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getConceptGroups,
  getConceptGroup,
  getCustomConceptsByIds,
  createConceptGroup,
  createCustomConcept,
} from "@/lib/db";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const items = await getConceptGroups(userId);
    return NextResponse.json(items);
  } catch (err) {
    console.error("Failed to fetch concept groups:", err);
    return NextResponse.json(
      { error: "Failed to fetch concept groups" },
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
    const domain = body.domain as string | undefined;
    const title = body.title as string | undefined;
    const concepts = body.concepts as
      | { title: string; summary: string; enrichmentPrompt: string }[]
      | undefined;
    const conceptIds = body.conceptIds as string[] | undefined;
    const sourceVideoTitle = typeof body.sourceVideoTitle === "string" ? body.sourceVideoTitle.trim() || undefined : undefined;
    const sourceTranscriptId =
      typeof body.sourceTranscriptId === "string"
        ? body.sourceTranscriptId.trim() || undefined
        : undefined;

    // Custom group: title + existing conceptIds (no AI, no new concepts)
    if (title && typeof title === "string" && title.trim() && Array.isArray(conceptIds)) {
      const validIds = conceptIds.filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0
      );
      const group = await createConceptGroup(
        userId,
        title.trim(),
        validIds,
        true
      );
      const conceptsList =
        validIds.length > 0
          ? await getCustomConceptsByIds(validIds, userId)
          : [];
      return NextResponse.json({ ...group, concepts: conceptsList });
    }

    // Domain (AI flow): domain + new concepts
    if (
      !domain ||
      typeof domain !== "string" ||
      !domain.trim() ||
      !Array.isArray(concepts) ||
      concepts.length === 0
    ) {
      return NextResponse.json(
        { error: "Either (title, conceptIds) for custom group or (domain, concepts) for domain are required" },
        { status: 400 }
      );
    }
    const newConceptIds: string[] = [];
    for (const c of concepts) {
      if (
        c &&
        typeof c.title === "string" &&
        typeof c.summary === "string" &&
        typeof c.enrichmentPrompt === "string"
      ) {
        const created = await createCustomConcept(
          userId,
          c.title.trim(),
          c.summary.trim(),
          c.enrichmentPrompt.trim(),
          sourceVideoTitle,
          sourceTranscriptId
        );
        newConceptIds.push(created._id!);
      }
    }
    if (newConceptIds.length === 0) {
      return NextResponse.json(
        { error: "No valid concepts to create" },
        { status: 400 }
      );
    }
    const group = await createConceptGroup(
      userId,
      domain.trim(),
      newConceptIds,
      false
    );
    const createdConcepts = await getCustomConceptsByIds(newConceptIds, userId);
    return NextResponse.json({ ...group, concepts: createdConcepts });
  } catch (err) {
    console.error("Failed to create concept group:", err);
    return NextResponse.json(
      { error: "Failed to create concept group" },
      { status: 500 }
    );
  }
}
