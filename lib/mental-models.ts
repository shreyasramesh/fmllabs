import fs from "fs";
import path from "path";
import yaml from "yaml";
import { isValidLanguageCode } from "@/lib/languages";

export interface MentalModelIndexEntry {
  id: string;
  name: string;
  path?: string; // Legacy; unused when loading from consolidated files
  description: string;
}

export interface MentalModelIndex {
  mental_models: MentalModelIndexEntry[];
}

export interface MentalModel {
  id: string;
  name: string;
  quick_introduction: string;
  in_more_detail: string;
  why_this_is_important: string;
  when_to_use: string[];
  how_can_you_spot_it: Record<string, string>;
  examples: Record<string, string>;
  real_world_implications: string | Record<string, string>;
  professional_application: Record<string, string>;
  how_can_this_be_misapplied: Record<string, string>;
  related_content: string[];
  one_liner?: string;
  try_this?: string[];
  ask_yourself?: string[];
}

/** Derive one-liner from quick_introduction if not set. */
export function getOneLiner(model: MentalModel): string {
  if (model.one_liner?.trim()) return model.one_liner.trim();
  const intro = model.quick_introduction;
  if (typeof intro !== "string" || !intro.trim()) return model.name || "Mental model";
  const first = intro.split(/[.!?]/)[0]?.trim();
  return first ? `${first}.` : intro.slice(0, 80);
}

/** Derive try_this from how_can_you_spot_it if not set. */
export function getTryThis(model: MentalModel): string[] {
  if (model.try_this?.length) return model.try_this;
  const entries = Object.entries(model.how_can_you_spot_it ?? {});
  return entries.slice(0, 2).map(([, v]) => {
    const s = v.trim();
    return s.startsWith("Notice") ? s : `Notice when ${s.toLowerCase()}`;
  });
}

const indexCache = new Map<string, MentalModelIndex>();
const modelsCache = new Map<string, MentalModel[]>();

const MENTAL_MODELS_DIR = "mental-models";

function getConsolidatedPath(language?: string | null): string | null {
  const base = path.join(process.cwd(), MENTAL_MODELS_DIR);
  if (language && isValidLanguageCode(language)) {
    const langPath = path.join(base, `mental-models-${language}.yaml`);
    if (fs.existsSync(langPath)) return langPath;
  }
  const defaultPath = path.join(base, "mental-models.yaml");
  if (fs.existsSync(defaultPath)) return defaultPath;
  const enPath = path.join(base, "mental-models-en.yaml");
  return fs.existsSync(enPath) ? enPath : null;
}

function loadConsolidatedModels(language?: string | null): MentalModel[] {
  const langKey = language && isValidLanguageCode(language) ? language : "default";
  const cached = modelsCache.get(langKey);
  if (cached) return cached;
  const filePath = getConsolidatedPath(language);
  if (!filePath) return [];
  const content = fs.readFileSync(filePath, "utf-8");
  const parsed = yaml.parse(content) as { mental_models?: MentalModel[] };
  const models = parsed?.mental_models ?? [];
  modelsCache.set(langKey, models);
  return models;
}

export function loadMentalModelsIndex(language?: string | null): MentalModelIndex {
  const langKey = language && isValidLanguageCode(language) ? language : "default";
  const cached = indexCache.get(langKey);
  if (cached) return cached;
  const models = loadConsolidatedModels(language);
  const index: MentalModelIndex = {
    mental_models: models.map((m) => ({
      id: m.id,
      name: m.name,
      path: "", // No longer used; content is in consolidated file
      description: typeof m.quick_introduction === "string" ? m.quick_introduction : "",
    })),
  };
  indexCache.set(langKey, index);
  return index;
}

export function loadMentalModelContent(id: string, language?: string | null): MentalModel | null {
  const models = loadConsolidatedModels(language);
  return models.find((m) => m.id === id) ?? null;
}

export interface MentalModelWithWhenToUse {
  id: string;
  name: string;
  when_to_use: string[];
}

function normalizeWhenToUse(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === "string") return item;
    if (typeof item === "object" && item !== null && !Array.isArray(item)) return Object.keys(item)[0] ?? "";
    return String(item ?? "");
  }).filter(Boolean);
}

/** Load all mental models with when_to_use for grouping in the library. */
export function loadAllMentalModelsWithWhenToUse(language?: string | null): MentalModelWithWhenToUse[] {
  const index = loadMentalModelsIndex(language);
  const result: MentalModelWithWhenToUse[] = [];
  for (const entry of index.mental_models) {
    const model = loadMentalModelContent(entry.id, language);
    if (model) {
      result.push({
        id: model.id,
        name: model.name,
        when_to_use: normalizeWhenToUse(model.when_to_use),
      });
    }
  }
  return result;
}

/** Slim context for low-latency chat: one-liner, try_this, quick_intro only. */
export function buildSlimContextForModels(ids: string[], language?: string | null): string {
  const parts: string[] = [];
  for (const id of ids) {
    const model = loadMentalModelContent(id, language);
    if (!model) continue;
    const oneLiner = getOneLiner(model);
    const tryThis = getTryThis(model);
    parts.push(
      `## ${model.name}\n**One-liner:** ${oneLiner}\n**Try this:** ${tryThis.join(" | ")}\n**Quick intro:** ${model.quick_introduction}`
    );
  }
  return parts.join("\n---\n");
}

export function buildContextForModels(ids: string[], language?: string | null): string {
  const parts: string[] = [];
  for (const id of ids) {
    const model = loadMentalModelContent(id, language);
    if (!model) continue;
    const oneLiner = getOneLiner(model);
    const tryThis = getTryThis(model);
    parts.push(`
## ${model.name}

**One-liner:** ${oneLiner}

**Try this:** ${tryThis.join(" | ")}

**Quick intro:** ${model.quick_introduction}

**In more detail:** ${model.in_more_detail}

**Why this matters:** ${model.why_this_is_important}

**When to use:** ${model.when_to_use.join(", ")}

**How to spot it:**
${Object.entries(model.how_can_you_spot_it)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n")}

**Examples:**
${Object.entries(model.examples)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n")}

**Professional application:**
${Object.entries(model.professional_application)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n")}

**How it can be misapplied:**
${Object.entries(model.how_can_this_be_misapplied)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n")}
`);
  }
  return parts.join("\n---\n");
}

export function getIndexSummary(language?: string | null): string {
  const index = loadMentalModelsIndex(language);
  return index.mental_models
    .map(
      (m) =>
        `- ${m.id}: ${m.name} — ${m.description}`
    )
    .join("\n");
}

/** Compact context with all mental model one-liners for the LLM. Format: id | name | one_liner */
export function buildAllOneLinersContext(language?: string | null): string {
  const index = loadMentalModelsIndex(language);
  const lines: string[] = [];
  for (const entry of index.mental_models) {
    const model = loadMentalModelContent(entry.id, language);
    if (!model) continue;
    const oneLiner = getOneLiner(model);
    lines.push(`${model.id} | ${model.name} | ${oneLiner}`);
  }
  return lines.join("\n");
}

/** Context for user @-mentions: name, in_more_detail, why_this_is_important, when_to_use. */
export function buildUserMentionContextForModels(ids: string[], language?: string | null): string {
  const parts: string[] = [];
  for (const id of ids) {
    const model = loadMentalModelContent(id, language);
    if (!model) continue;
    parts.push(
      `## ${model.name}\n**In more detail:** ${model.in_more_detail}\n**Why this is important:** ${model.why_this_is_important}\n**When to use:** ${model.when_to_use.join(", ")}`
    );
  }
  return parts.join("\n---\n");
}
