#!/usr/bin/env node
/**
 * Translates all mental models from English to each supported language.
 * Uses Gemini API. Run: node scripts/translate-mental-models.mjs
 * Requires GEMINI_API_KEY in .env.local
 */
import "./load-env.mjs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
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

function buildIndexForLang(langCode) {
  const dir = join(root, `mental-models-${langCode}`);
  const files = readdirSync(dir).filter((f) => f.endsWith(".yaml"));
  const entries = [];

  for (const file of files) {
    const content = readFileSync(join(dir, file), "utf-8");
    let id, name, desc;

    try {
      const parsed = yaml.parse(content);
      if (parsed?.id) {
        id = parsed.id;
        name = parsed.name ?? parsed.id.replace(/_/g, " ");
        desc = parsed.quick_introduction?.trim() ?? "";
      }
    } catch {
      /* Fallback: extract via regex when YAML parse fails (e.g. colons in one_liner, quoted strings) */
      const idMatch = content.match(/^id:\s*([a-z0-9_]+)/m);
      const nameMatch = content.match(/^name:\s*(.+)$/m);
      const quickMatch = content.match(/^quick_introduction:\s*\|\s*\n([\s\S]*?)(?=\n[a-z_][a-z0-9_]*:)/m);
      if (idMatch) {
        id = idMatch[1].trim();
        name = nameMatch ? nameMatch[1].trim() : id.replace(/_/g, " ");
        desc = quickMatch ? quickMatch[1].split("\n").map((l) => l.replace(/^\s+/, "")).join("\n").trim() : "";
      }
    }

    if (id) {
      entries.push({ id, name: name ?? id.replace(/_/g, " "), path: `mental-models-${langCode}/${file}`, description: desc ?? "" });
    }
  }

  const sorted = entries.sort((a, b) => a.id.localeCompare(b.id));
  const yamlContent = `# yaml-language-server: $schema=schema/mental-models-index-schema.json
# Mental Models & Cognitive Biases Index (${LANGUAGES.find((l) => l.code === langCode)?.name ?? langCode})

mental_models:
${sorted
  .map((e) => {
    const descLines = (e.description || "").split("\n").map((s) => "      " + s);
    return `  - id: ${e.id}
    name: ${e.name}
    path: ${e.path}
    description: |
${descLines.join("\n")}`;
  })
  .join("\n\n")}
`;
  writeFileSync(join(root, `mental-models-index-${langCode}.yaml`), yamlContent, "utf-8");
}

async function main() {
  const sourceDir = join(root, "mental-models-en");
  const files = readdirSync(sourceDir).filter((f) => f.endsWith(".yaml"));

  buildIndexForLang("en");
  console.log("Built mental-models-index-en.yaml");

  const langArg = process.argv.find((a) => a.startsWith("--lang="));
  const onlyLang = langArg ? langArg.split("=")[1] : null;
  const skipExisting = process.argv.includes("--skip-existing");
  const indexOnly = process.argv.includes("--index-only");

  if (indexOnly) {
    const langsToBuild = onlyLang ? [onlyLang] : LANGUAGES.map((l) => l.code);
    for (const code of langsToBuild) {
      const dir = join(root, `mental-models-${code}`);
      if (existsSync(dir)) {
        buildIndexForLang(code);
        console.log(`Built mental-models-index-${code}.yaml`);
      }
    }
    console.log("Done.");
    return;
  }

  const targetLangs = LANGUAGES.filter((l) => l.code !== "en").filter(
    (l) => !onlyLang || l.code === onlyLang
  );

  if (onlyLang && targetLangs.length === 0) {
    console.error(`Unknown language: ${onlyLang}`);
    process.exit(1);
  }

  for (const lang of targetLangs) {
    const outDir = join(root, `mental-models-${lang.code}`);
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    console.log(`\n--- ${lang.name} (${lang.code}) ---`);

    for (const file of files) {
      const srcPath = join(sourceDir, file);
      const outPath = join(outDir, file);
      if (skipExisting && existsSync(outPath)) {
        console.log(`  ✓ ${file} (skipped, exists)`);
        continue;
      }
      const content = readFileSync(srcPath, "utf-8");

      try {
        const translated = await translateYaml(content, lang.code);
        const cleaned = translated.replace(/^```yaml\s*/i, "").replace(/\s*```\s*$/i, "").trim();
        writeFileSync(outPath, cleaned + "\n", "utf-8");
        console.log(`  ✓ ${file}`);
      } catch (err) {
        console.error(`  ✗ ${file}:`, err.message);
      }

      await new Promise((r) => setTimeout(r, 500));
    }

    buildIndexForLang(lang.code);
    console.log(`  Built mental-models-index-${lang.code}.yaml`);
  }

  console.log("\nDone.");
}

main().catch(console.error);
