import fs from "fs";
import path from "path";
import yaml from "yaml";

export interface PerspectiveCard {
  id: string;
  name: string;
  prompt: string;
  follow_ups?: string[];
  domain?: string;
}

export interface PerspectiveDeckIndexEntry {
  id: string;
  name: string;
  path: string;
  description: string;
  domain: string;
  subdomain_id?: string;
  subdomain_name?: string;
}

export type DomainConfig = string | { name: string; description: string };

export interface PerspectiveDeckIndex {
  domains?: Record<string, DomainConfig>;
  decks: PerspectiveDeckIndexEntry[];
}

export function getDomainDisplayName(domains: PerspectiveDeckIndex["domains"] | undefined, domainId: string): string {
  const config = domains?.[domainId];
  if (!config) return domainId.replace(/_/g, " ");
  if (typeof config === "string") return domainId.replace(/_/g, " ");
  return config.name;
}

export function getDomainDescription(domains: PerspectiveDeckIndex["domains"] | undefined, domainId: string): string {
  const config = domains?.[domainId];
  if (!config) return "";
  if (typeof config === "string") return config;
  return config.description;
}

export interface PerspectiveDeck {
  id: string;
  name: string;
  description: string;
  domain: string;
  cards: PerspectiveCard[];
}

const indexCache = new Map<string, PerspectiveDeckIndex>();

function getIndexPath(): string {
  return path.join(process.cwd(), "perspective-decks", "perspective-decks-index.yaml");
}

export function loadPerspectiveDecksIndex(): PerspectiveDeckIndex {
  const cached = indexCache.get("default");
  if (cached) return cached;
  const indexPath = getIndexPath();
  if (!fs.existsSync(indexPath)) {
    indexCache.set("default", { decks: [] });
    return { decks: [] };
  }
  const content = fs.readFileSync(indexPath, "utf-8");
  const parsed = yaml.parse(content) as PerspectiveDeckIndex;
  const result = parsed?.decks ? parsed : { decks: [] };
  indexCache.set("default", result);
  return result;
}

export function loadPerspectiveDeck(deckId: string): PerspectiveDeck | null {
  const index = loadPerspectiveDecksIndex();
  const entry = index.decks.find((d) => d.id === deckId);
  if (!entry) return null;

  const filePath = path.join(process.cwd(), entry.path);
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, "utf-8");
  const parsed = yaml.parse(content) as PerspectiveDeck;
  if (!parsed?.cards?.length) return null;

  return {
    ...parsed,
    id: parsed.id ?? entry.id,
    name: parsed.name ?? entry.name,
    description: parsed.description ?? entry.description,
    domain: parsed.domain ?? entry.domain,
    cards: parsed.cards.map((c) => ({
      ...c,
      domain: c.domain ?? parsed.domain ?? entry.domain,
    })),
  };
}

export function getRandomCardFromDeck(deckId: string): PerspectiveCard | null {
  const deck = loadPerspectiveDeck(deckId);
  if (!deck || deck.cards.length === 0) return null;
  const idx = Math.floor(Math.random() * deck.cards.length);
  return deck.cards[idx] ?? null;
}

export function getCardFromDeck(
  deckId: string,
  cardId: string
): PerspectiveCard | null {
  const deck = loadPerspectiveDeck(deckId);
  if (!deck) return null;
  return deck.cards.find((c) => c.id === cardId) ?? null;
}
