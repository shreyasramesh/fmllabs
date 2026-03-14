import { NextResponse } from "next/server";
import { loadPerspectiveDeck } from "@/lib/perspective-decks";
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
    const deck = loadPerspectiveDeck(deckId, lang);
    if (!deck) {
      return NextResponse.json(
        { error: "Deck not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(deck);
  } catch (err) {
    console.error("Failed to fetch perspective deck:", err);
    return NextResponse.json(
      { error: "Failed to fetch deck" },
      { status: 500 }
    );
  }
}
