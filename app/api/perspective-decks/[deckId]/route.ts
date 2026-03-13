import { NextResponse } from "next/server";
import { loadPerspectiveDeck } from "@/lib/perspective-decks";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ deckId: string }> }
) {
  try {
    const { deckId } = await params;
    const deck = loadPerspectiveDeck(deckId);
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
