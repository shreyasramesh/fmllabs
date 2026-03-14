#!/usr/bin/env node
/**
 * Repair consolidated mental model YAML files to satisfy schema-like checks.
 *
 * - Normalizes malformed IDs to snake_case ascii
 * - Backfills missing required fields from English (by id, then index fallback)
 * - Fixes malformed when_to_use / object fields
 * - Cleans related_content to reference only existing IDs in the same file
 *
 * Usage:
 *   node scripts/fix-mental-models-yaml.mjs
 *   node scripts/fix-mental-models-yaml.mjs --lang=pt
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import yaml from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const modelsDir = join(root, "mental-models");

const REQUIRED_STRINGS = [
  "name",
  "quick_introduction",
  "in_more_detail",
  "why_this_is_important",
];

const REQUIRED_OBJECTS = [
  "how_can_you_spot_it",
  "examples",
  "professional_application",
  "how_can_this_be_misapplied",
];

function normalizeId(input, fallback) {
  const base = typeof input === "string" && input.trim() ? input : fallback;
  return String(base ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/__+/g, "_");
}

function hasText(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function isStringRecord(v) {
  return (
    v != null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.values(v).every((x) => typeof x === "string")
  );
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function targetFiles() {
  const langArg = process.argv.find((a) => a.startsWith("--lang="));
  const lang = langArg ? langArg.split("=")[1] : null;
  if (lang) return [`mental-models-${lang}.yaml`];
  return readdirSync(modelsDir)
    .filter((f) => /^mental-models-[a-z]{2}\.yaml$/i.test(f))
    .sort();
}

function main() {
  const enPath = join(modelsDir, "mental-models-en.yaml");
  if (!existsSync(enPath)) {
    console.error("Missing baseline file: mental-models/mental-models-en.yaml");
    process.exit(1);
  }
  const enDoc = yaml.parse(readFileSync(enPath, "utf8"));
  const enModels = Array.isArray(enDoc?.mental_models) ? enDoc.mental_models : [];
  const enById = new Map(enModels.map((m) => [m.id, m]));

  const files = targetFiles();
  for (const file of files) {
    const abs = join(modelsDir, file);
    if (!existsSync(abs)) {
      console.warn(`skip: ${file} (missing)`);
      continue;
    }

    const raw = readFileSync(abs, "utf8");
    const headerMatch = raw.match(/^(#.*\n)+\n?/);
    const header = headerMatch ? headerMatch[0] : "";

    const parsed = yaml.parse(raw);
    const models = Array.isArray(parsed?.mental_models) ? parsed.mental_models : [];
    if (models.length === 0) {
      console.warn(`skip: ${file} (no mental_models array)`);
      continue;
    }

    // Pass 1: normalize ids + ensure uniqueness.
    const seen = new Set();
    for (let i = 0; i < models.length; i += 1) {
      const fallbackId = enModels[i]?.id ?? `model_${i}`;
      let id = normalizeId(models[i]?.id, fallbackId) || fallbackId;
      while (seen.has(id)) id = `${id}_${i}`;
      seen.add(id);
      models[i].id = id;
    }

    const idsSet = new Set(models.map((m) => m.id));

    // Pass 2: repair fields.
    for (let i = 0; i < models.length; i += 1) {
      const m = models[i];
      const base = enById.get(m.id) ?? enModels[i] ?? {};

      for (const key of REQUIRED_STRINGS) {
        if (!hasText(m[key])) m[key] = hasText(base[key]) ? base[key] : "TBD";
      }

      if (!Array.isArray(m.when_to_use)) {
        m.when_to_use = Array.isArray(base.when_to_use) ? clone(base.when_to_use) : ["decision_making"];
      } else {
        m.when_to_use = m.when_to_use.filter((x) => typeof x === "string" && x.trim().length > 0);
        if (m.when_to_use.length === 0) {
          m.when_to_use = Array.isArray(base.when_to_use) && base.when_to_use.length > 0
            ? clone(base.when_to_use)
            : ["decision_making"];
        }
      }

      for (const key of REQUIRED_OBJECTS) {
        if (!isStringRecord(m[key])) {
          m[key] = isStringRecord(base[key]) ? clone(base[key]) : {};
        }
      }

      const rwi = m.real_world_implications;
      if (!(hasText(rwi) || isStringRecord(rwi))) {
        m.real_world_implications =
          hasText(base.real_world_implications) || isStringRecord(base.real_world_implications)
            ? clone(base.real_world_implications)
            : "";
      }

      // related_content: keep only valid ids in this file.
      let related = Array.isArray(m.related_content)
        ? m.related_content
            .filter((x) => typeof x === "string")
            .map((x) => normalizeId(x, ""))
            .filter((x) => x && idsSet.has(x) && x !== m.id)
        : [];

      if (related.length === 0 && Array.isArray(base.related_content)) {
        related = base.related_content
          .map((x) => normalizeId(x, ""))
          .filter((x) => x && idsSet.has(x) && x !== m.id);
      }

      m.related_content = [...new Set(related)];
    }

    parsed.mental_models = models;
    const out = header + yaml.stringify(parsed, { lineWidth: 0 });
    writeFileSync(abs, out, "utf8");
    console.log(`fixed: ${file}`);
  }
}

main();
