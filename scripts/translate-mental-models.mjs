#!/usr/bin/env node
/**
 * Translates mental models from English to each supported language.
 * Uses Gemini API. Run: node scripts/translate-mental-models.mjs
 * Requires GEMINI_API_KEY in .env.local
 *
 * Source: mental-models-en.yaml (single consolidated file)
 * Output: mental-models-{lang}.yaml (one file per language)
 */
import "./load-env.mjs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import yaml from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi" },
  { code: "ta", name: "Tamil" },
  { code: "kn", name: "Kannada" },
  { code: "ja", name: "Japanese" },
  { code: "zh", name: "Mandarin Chinese" },
  { code: "es", name: "Spanish" },
  { code: "ar", name: "Arabic" },
  { code: "fr", name: "French" },
  { code: "bn", name: "Bengali" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "ur", name: "Urdu" },
];

const apiKey = process.env.GEMINI_API_KEY?.trim();
if (!apiKey) {
  console.error("GEMINI_API_KEY is required. Add it to .env.local");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash-lite" });

async function translateYaml(content, targetLang, retries = 3) {
  const lang = LANGUAGES.find((l) => l.code === targetLang);
  const langName = lang?.name ?? targetLang;

  const prompt = `You are a professional translator. Translate the following YAML content into ${langName}.

RULES:
1. Translate ALL user-facing text (names, descriptions, explanations, examples, etc.) into ${langName}.
2. Keep the YAML structure EXACTLY the same. Do not change keys, indentation, or structure.
3. Keep these UNCHANGED: id, related_content (these are identifiers).
4. For when_to_use: translate the tag values to ${langName} (e.g. "decision-making" -> the equivalent in ${langName}). Use snake_case for multi-word tags.
5. Preserve markdown formatting, line breaks, and special characters.
6. Return ONLY the translated YAML, no explanations or markdown code blocks.

YAML to translate:
${content}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await model.generateContent(prompt);
      return res.response.text().trim();
    } catch (err) {
      if (attempt < retries && (err.message?.includes("503") || err.message?.includes("429"))) {
        const delay = attempt * 2000;
        console.log(`    Retry ${attempt}/${retries} in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}

async function main() {
  const sourcePath = join(root, "mental-models", "mental-models-en.yaml");
  if (!existsSync(sourcePath)) {
    console.error("Source not found: mental-models/mental-models-en.yaml");
    process.exit(1);
  }

  const sourceContent = readFileSync(sourcePath, "utf-8");
  const source = yaml.parse(sourceContent);
  const models = source?.mental_models ?? [];

  const langArg = process.argv.find((a) => a.startsWith("--lang="));
  const onlyLang = langArg ? langArg.split("=")[1] : null;
  const skipExisting = process.argv.includes("--skip-existing");

  const targetLangs = LANGUAGES.filter((l) => l.code !== "en").filter(
    (l) => !onlyLang || l.code === onlyLang
  );

  if (onlyLang && targetLangs.length === 0) {
    console.error(`Unknown language: ${onlyLang}`);
    process.exit(1);
  }

  for (const lang of targetLangs) {
    const outPath = join(root, "mental-models", `mental-models-${lang.code}.yaml`);
    if (skipExisting && existsSync(outPath)) {
      console.log(`✓ ${lang.name}: mental-models/mental-models-${lang.code}.yaml (skipped, exists)`);
      continue;
    }
    console.log(`\n--- ${lang.name} (${lang.code}) ---`);

    const translatedModels = [];
    for (let i = 0; i < models.length; i++) {
      const modelData = models[i];
      const singleModelYaml = yaml.stringify(modelData, { lineWidth: 0 });
      try {
        const translated = await translateYaml(singleModelYaml, lang.code);
        const cleaned = translated.replace(/^```yaml\s*/i, "").replace(/\s*```\s*$/i, "").trim();
        const parsed = yaml.parse(cleaned);
        if (parsed?.id) translatedModels.push(parsed);
        else translatedModels.push(modelData);
        console.log(`  ✓ ${modelData.id}`);
      } catch (err) {
        console.error(`  ✗ ${modelData.id}:`, err.message);
        translatedModels.push(modelData);
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    translatedModels.sort((a, b) => (a.id || "").localeCompare(b.id || ""));
    mkdirSync(join(root, "mental-models"), { recursive: true });
    const header = `# yaml-language-server: $schema=../schema/mental-models-consolidated-schema.json
# Mental Models & Cognitive Biases (${lang.name})
# Translated from mental-models-en.yaml

`;
    const yamlContent = header + yaml.stringify({ mental_models: translatedModels }, { lineWidth: 0 });
    writeFileSync(outPath, yamlContent, "utf-8");
    console.log(`  → mental-models/mental-models-${lang.code}.yaml (${translatedModels.length} models)`);
  }

  console.log("\nDone.");
}

main().catch(console.error);
