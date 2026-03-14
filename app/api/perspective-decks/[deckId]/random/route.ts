import { NextResponse } from "next/server";
import { getRandomCardFromDeck } from "@/lib/perspective-decks";
import { isValidLanguageCode } from "@/lib/languages";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    const { deckId } = await params;
    const { searchParams } = new URL(request.url);
    const language = searchParams.get("language");
    const lang = language && isValidLanguageCode(language) ? language : undefined;
    const card = getRandomCardFromDeck(deckId, lang);
    if (!card) {
      return NextResponse.json(
        { error: "Deck not found or has no cards" },
        { status: 404 }
      );
    }
    return NextResponse.json({ card, deckId });
  } catch (err) {
    console.error("Failed to fetch random perspective card:", err);
    return NextResponse.json(
      { error: "Failed to fetch card" },
      { status: 500 }
    );
  }
}
