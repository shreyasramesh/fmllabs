import { NextResponse } from "next/server";
import { getRandomCardFromDeck } from "@/lib/perspective-decks";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    const { deckId } = await params;
    const card = getRandomCardFromDeck(deckId);
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
