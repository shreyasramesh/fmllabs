import fs from "fs";
import path from "path";
import yaml from "yaml";

export interface FamousFigureCategory {
  id: string;
  name: string;
}

export interface FamousFigure {
  id: string;
  name: string;
  description: string;
  category: string;
}

export interface FamousFiguresData {
  categories: FamousFigureCategory[];
  figures: FamousFigure[];
}

const cache = new Map<string, FamousFiguresData>();
const FAMOUS_FIGURES_PATH = path.join(process.cwd(), "famous-figures", "famous-figures.yaml");

function loadFamousFiguresRaw(): FamousFiguresData {
  const cached = cache.get("default");
  if (cached) return cached;
  if (!fs.existsSync(FAMOUS_FIGURES_PATH)) {
    const empty: FamousFiguresData = { categories: [], figures: [] };
    cache.set("default", empty);
    return empty;
  }
  const content = fs.readFileSync(FAMOUS_FIGURES_PATH, "utf-8");
  const parsed = yaml.parse(content) as FamousFiguresData;
  const data: FamousFiguresData = {
    categories: parsed?.categories ?? [],
    figures: parsed?.figures ?? [],
  };
  cache.set("default", data);
  return data;
}

export function loadFamousFigures(): FamousFiguresData {
  return loadFamousFiguresRaw();
}

export function getFiguresByCategory(categoryId?: string | null): FamousFigure[] {
  const { figures } = loadFamousFiguresRaw();
  if (!categoryId || categoryId === "all") return figures;
  return figures.filter((f) => f.category === categoryId);
}

export function searchFigures(query: string): FamousFigure[] {
  const { figures } = loadFamousFiguresRaw();
  if (!query?.trim()) return figures;
  const q = query.toLowerCase().trim();
  return figures.filter(
    (f) =>
      f.name.toLowerCase().includes(q) ||
      f.description.toLowerCase().includes(q) ||
      f.id.toLowerCase().includes(q)
  );
}

export function getFigureById(id: string): FamousFigure | null {
  const { figures } = loadFamousFiguresRaw();
  return figures.find((f) => f.id === id) ?? null;
}

export function getFiguresByIds(ids: string[]): FamousFigure[] {
  const { figures } = loadFamousFiguresRaw();
  const idSet = new Set(ids);
  return figures.filter((f) => idSet.has(f.id));
}
