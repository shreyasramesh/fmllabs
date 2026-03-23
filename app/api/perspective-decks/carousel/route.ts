import { NextResponse } from "next/server";
import {
  loadPerspectiveDecksIndex,
  loadPerspectiveDeck,
  getDomainDisplayName,
} from "@/lib/perspective-decks";
import { isValidLanguageCode } from "@/lib/languages";

/** Deck ID + card ID pairs for `/api/perspective-decks/carousel` (perspective prompt cards; not used by the chat starter carousel UI). */
const CAROUSEL_CARDS: { deckId: string; cardId: string }[] = [
  { deckId: "ways_of_looking_at_art", cardId: "souvenir" },
  { deckId: "urban_jungle_new_york", cardId: "ny_vertical_city" },
  { deckId: "culinary_lab_indian", cardId: "ind_tadka_crackle" },
  { deckId: "natural_microcosm_forest_floor", cardId: "nmf_leaf_vein" },
  { deckId: "human_interface_coffee_shop", cardId: "hi_cs_queue_choreography" },
  { deckId: "ways_of_looking_at_art", cardId: "in_black_and_white" },
  { deckId: "urban_jungle_new_york", cardId: "ny_subway_soundscape" },
  { deckId: "culinary_lab_indian", cardId: "ind_thali_geometry" },
  { deckId: "natural_microcosm_forest_floor", cardId: "nmf_mushroom_fruiting" },
  { deckId: "human_interface_coffee_shop", cardId: "hi_cs_invisible_script" },
];

export interface CarouselCard {
  name: string;
  prompt: string;
  domain: string;
  subdomain: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const language = searchParams.get("language");
    const lang = language && isValidLanguageCode(language) ? language : undefined;

    const index = loadPerspectiveDecksIndex(lang);
    const domains = index.domains ?? {};
    const cards: CarouselCard[] = [];

    for (const { deckId, cardId } of CAROUSEL_CARDS) {
      const entry = index.decks.find((d) => d.id === deckId);
      const deck = loadPerspectiveDeck(deckId, lang);
      if (!deck || !entry) continue;
      const card = deck.cards.find((c) => c.id === cardId);
      if (!card) continue;

      const domainId = deck.domain ?? "";
      const domainDisplay = getDomainDisplayName(domains, domainId);
      const subdomain = entry.subdomain_name ?? entry.name ?? domainDisplay;

      cards.push({
        name: card.name,
        prompt: card.prompt,
        domain: domainDisplay,
        subdomain,
      });
    }

    return NextResponse.json({ cards });
  } catch (err) {
    console.error("Failed to fetch carousel cards:", err);
    return NextResponse.json(
      { error: "Failed to fetch carousel cards" },
      { status: 500 }
    );
  }
}
