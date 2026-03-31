import fs from "fs";
import path from "path";
import yaml from "yaml";
import { isValidLanguageCode } from "@/lib/languages";

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
type ParsedPerspectiveDeck = Omit<Partial<PerspectiveDeck>, "cards"> & {
  cards?: PerspectiveCard[];
};
const deckFileCache = new Map<string, ParsedPerspectiveDeck | null>();

function getIndexPath(language?: string | null): string {
  const base = path.join(process.cwd(), "perspective-decks", "perspective-decks-index.yaml");
  if (!language || !isValidLanguageCode(language) || language === "en") {
    return base;
  }
  const langPath = path.join(process.cwd(), "perspective-decks", `perspective-decks-index-${language}.yaml`);
  return fs.existsSync(langPath) ? langPath : base;
}

export function loadPerspectiveDecksIndex(language?: string | null): PerspectiveDeckIndex {
  const cacheKey = language && isValidLanguageCode(language) && language !== "en" ? language : "default";
  const cached = indexCache.get(cacheKey);
  if (cached) return cached;
  const indexPath = getIndexPath(language);
  if (!fs.existsSync(indexPath)) {
    indexCache.set(cacheKey, { decks: [] });
    return { decks: [] };
  }
  const content = fs.readFileSync(indexPath, "utf-8");
  const parsed = yaml.parse(content) as PerspectiveDeckIndex;
  const result = parsed?.decks ? parsed : { decks: [] };
  indexCache.set(cacheKey, result);
  return result;
}

function getDeckFilePath(entryPath: string, language?: string | null): string {
  const base = path.join(process.cwd(), entryPath);
  if (!language || !isValidLanguageCode(language) || language === "en") {
    return base;
  }
  const langPath = base.replace(/\.yaml$/i, `-${language}.yaml`);
  return fs.existsSync(langPath) ? langPath : base;
}

export function loadPerspectiveDeck(deckId: string, language?: string | null): PerspectiveDeck | null {
  const index = loadPerspectiveDecksIndex(language);
  const entry = index.decks.find((d) => d.id === deckId);
  if (!entry) return null;

  const filePath = getDeckFilePath(entry.path, language);
  const cached = deckFileCache.get(filePath);
  let parsed = cached;
  if (parsed === undefined) {
    if (!fs.existsSync(filePath)) {
      deckFileCache.set(filePath, null);
      return null;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    const parsedYaml = yaml.parse(content) as ParsedPerspectiveDeck;
    parsed = parsedYaml?.cards?.length ? parsedYaml : null;
    deckFileCache.set(filePath, parsed);
  }
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

export function getRandomCardFromDeck(deckId: string, language?: string | null): PerspectiveCard | null {
  const deck = loadPerspectiveDeck(deckId, language);
  if (!deck || deck.cards.length === 0) return null;
  const idx = Math.floor(Math.random() * deck.cards.length);
  return deck.cards[idx] ?? null;
}

export function getCardFromDeck(
  deckId: string,
  cardId: string,
  language?: string | null
): PerspectiveCard | null {
  const deck = loadPerspectiveDeck(deckId, language);
  if (!deck) return null;
  return deck.cards.find((c) => c.id === cardId) ?? null;
}
