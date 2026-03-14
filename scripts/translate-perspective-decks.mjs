#!/usr/bin/env node
/**
 * Translates perspective decks from English to each supported language.
 * Uses Gemini API. Run: node scripts/translate-perspective-decks.mjs
 * Requires GEMINI_API_KEY in .env.local
 *
 * Source: perspective-decks/*.yaml (from index, including subdirectories)
 * Output: {basePath}-{lang}.yaml (e.g. culinary-lab-indian-fr.yaml)
 *
 * Options:
 *   --lang=fr    Translate only one language
 *   --skip-existing   Skip decks that already have a translated file
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

async function translateDeckYaml(content, targetLang, retries = 3) {
  const lang = LANGUAGES.find((l) => l.code === targetLang);
  const langName = lang?.name ?? targetLang;

  const prompt = `You are a professional translator. Translate the following YAML perspective deck into ${langName}.

RULES:
1. Translate: name, description (deck level) and each card's name, prompt, follow_ups into ${langName}.
2. Keep the YAML structure EXACTLY the same. Do not change keys, indentation, or structure.
3. Keep these UNCHANGED: id, domain (these are identifiers).
4. CRITICAL YAML: For follow_ups array items, use "- " (dash space) then the text. Never use double quotes inside strings. Use block scalar (|) for prompt if it has multiple lines. Each array item must start with "- " (exactly dash, space, then text).
5. Preserve markdown formatting and line breaks.
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

function getDeckPaths() {
  const indexPath = join(root, "perspective-decks", "perspective-decks-index.yaml");
  if (!existsSync(indexPath)) {
    console.error("Index not found: perspective-decks/perspective-decks-index.yaml");
    process.exit(1);
  }
  const index = yaml.parse(readFileSync(indexPath, "utf-8"));
  const decks = index?.decks ?? [];
  return decks.map((d) => d.path).filter(Boolean);
}

async function main() {
  const deckPaths = getDeckPaths();
  if (deckPaths.length === 0) {
    console.error("No decks found in index");
    process.exit(1);
  }

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
    console.log(`\n--- ${lang.name} (${lang.code}) ---`);

    for (const deckPath of deckPaths) {
      const sourcePath = join(root, deckPath);
      const basePath = deckPath.replace(/\.yaml$/i, "");
      const outPath = join(root, `${basePath}-${lang.code}.yaml`);

      if (skipExisting && existsSync(outPath)) {
        console.log(`  ✓ ${deckPath} (skipped, exists)`);
        continue;
      }

      if (!existsSync(sourcePath)) {
        console.error(`  ✗ ${deckPath}: source not found`);
        continue;
      }

      try {
        const content = readFileSync(sourcePath, "utf-8");
        let parsed = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
          const translated = await translateDeckYaml(content, lang.code, 3);
          let cleaned = translated.replace(/^```yaml\s*/i, "").replace(/\s*```\s*$/i, "").trim();
          cleaned = cleaned.replace(/\n(\s+)-([^\s-])/g, "\n$1- $2");
          try {
            parsed = yaml.parse(cleaned);
            if (parsed?.cards?.length) break;
          } catch (parseErr) {
            if (attempt === 2) throw parseErr;
            await new Promise((r) => setTimeout(r, 1000));
          }
        }

        if (!parsed?.cards?.length) {
          console.error(`  ✗ ${deckPath}: invalid translation (no cards)`);
          continue;
        }

        const outDir = dirname(outPath);
        mkdirSync(outDir, { recursive: true });

        const pathSegments = deckPath.replace(/\\/g, "/").split("/");
        const depth = Math.max(0, pathSegments.length - 1);
        const schemaPath = "../".repeat(depth) + "schema/perspective-deck-schema.json";
        const header = `# yaml-language-server: $schema=${schemaPath}
# ${parsed.name ?? "Perspective Deck"} (${lang.name})

`;

        const yamlContent = header + yaml.stringify(parsed, { lineWidth: 0 });
        writeFileSync(outPath, yamlContent, "utf-8");
        console.log(`  ✓ ${basePath}-${lang.code}.yaml`);
      } catch (err) {
        console.error(`  ✗ ${deckPath}:`, err.message);
      }

      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log("\nDone.");
}

main().catch(console.error);
