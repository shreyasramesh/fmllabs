import { NextResponse } from "next/server";
import { loadPerspectiveDecksIndex } from "@/lib/perspective-decks";

export async function GET() {
  try {
    const index = loadPerspectiveDecksIndex();
    const list = index.decks.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      domain: d.domain,
    }));
    return NextResponse.json(list);
  } catch (err) {
    console.error("Failed to list perspective decks:", err);
    return NextResponse.json(
      { error: "Failed to list perspective decks" },
      { status: 500 }
    );
  }
}
