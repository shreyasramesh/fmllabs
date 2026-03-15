#!/usr/bin/env node
/**
 * Consolidates mental models from per-model YAML files into one file per language.
 * Before: mental-models-{lang}/model-name.yaml (many files)
 * After:  mental-models-{lang}.yaml (one file with all models)
 *
 * Run: node scripts/consolidate-mental-models.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import yaml from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const LANG_NAMES = {
  en: "English",
  hi: "Hindi",
  ta: "Tamil",
  kn: "Kannada",
  ja: "Japanese",
  zh: "Mandarin Chinese",
  es: "Spanish",
  ar: "Arabic",
  fr: "French",
  bn: "Bengali",
  pt: "Portuguese",
  ru: "Russian",
  ur: "Urdu",
};

function consolidateForLang(langCode) {
  const dir = join(root, `mental-models-${langCode}`);
  if (!existsSync(dir)) return null;

  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .sort();

  const models = [];
  for (const file of files) {
    const content = readFileSync(join(dir, file), "utf-8");
    try {
      const parsed = yaml.parse(content);
      if (parsed?.id) models.push(parsed);
    } catch (err) {
      console.error(`  ✗ ${file}: ${err.message}`);
    }
  }

  models.sort((a, b) => (a.id || "").localeCompare(b.id || ""));

  const langName = LANG_NAMES[langCode] ?? langCode;
  const header = `# yaml-language-server: $schema=../schema/mental-models-consolidated-schema.json
# Mental Models & Cognitive Biases (${langName})
# Consolidated from mental-models-${langCode}/

`;
  const outDir = join(root, "mental-models");
  mkdirSync(outDir, { recursive: true });
  const yamlContent = header + yaml.stringify({ mental_models: models }, { lineWidth: 0 });
  const outPath = join(outDir, `mental-models-${langCode}.yaml`);
  writeFileSync(outPath, yamlContent, "utf-8");
  return { path: outPath, count: models.length };
}

function main() {
  const langArg = process.argv.find((a) => a.startsWith("--lang="));
  const onlyLang = langArg ? langArg.split("=")[1] : null;

  const toProcess = onlyLang
    ? [onlyLang]
    : ["en", "hi", "ta", "kn", "ja", "zh", "es", "ar", "fr", "bn", "pt", "ru", "ur", "de", "it", "pl", "uk", "ro", "nl", "tr"];

  for (const code of toProcess) {
    if (code === "default") continue;
    const dir = join(root, `mental-models-${code}`);
    if (!existsSync(dir)) continue;
    const result = consolidateForLang(code);
    if (result) console.log(`  → ${result.path.replace(root + "/", "")} (${result.count} models)`);
  }

  console.log("\nDone. Output: mental-models/mental-models-{lang}.yaml");
}

main();
