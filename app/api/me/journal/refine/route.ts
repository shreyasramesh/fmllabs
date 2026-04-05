import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  refineJournalEntryWithPersona,
  type JournalPersonaLens,
} from "@/lib/gemini";
import { EXTRACT_CONCEPTS_MAX_TOTAL_CHARS } from "@/lib/extract-concepts-constants";
import { rateLimitByUser, tooManyRequestsResponse } from "@/lib/rate-limit";

const VALID_ENTRY_TYPES = new Set(["gratitude", "reflection"]);
const VALID_PERSONAS = new Set<JournalPersonaLens>([
  "critical",
  "contrarian",
  "systems_thinker",
  "stoic",
]);

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rl = rateLimitByUser(userId, { max: 15, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequestsResponse(rl.resetMs);

  try {
    const body = await request.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const entryType = typeof body.entryType === "string" ? body.entryType.trim() : "";
    const persona = typeof body.persona === "string" ? body.persona.trim() : "";

    if (!text) {
      return NextResponse.json({ error: "Journal text is required." }, { status: 400 });
    }
    if (text.length > EXTRACT_CONCEPTS_MAX_TOTAL_CHARS) {
      return NextResponse.json(
        { error: `Journal text must be at most ${EXTRACT_CONCEPTS_MAX_TOTAL_CHARS} characters.` },
        { status: 400 }
      );
    }
    if (!VALID_ENTRY_TYPES.has(entryType)) {
      return NextResponse.json({ error: "Invalid journal entry type." }, { status: 400 });
    }
    if (!VALID_PERSONAS.has(persona as JournalPersonaLens)) {
      return NextResponse.json({ error: "Invalid persona." }, { status: 400 });
    }

    const refinedText = await refineJournalEntryWithPersona(
      text,
      entryType as "gratitude" | "reflection",
      persona as JournalPersonaLens,
      { userId, eventType: "journal_refine_persona" }
    );
    return NextResponse.json({ refinedText });
  } catch (err) {
    console.error("Journal refine error:", err);
    return NextResponse.json({ error: "Failed to refine journal entry." }, { status: 500 });
  }
}
