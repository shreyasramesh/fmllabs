#!/usr/bin/env node
/**
 * Verifies consolidated mental model YAML files.
 *
 * Usage:
 *   node scripts/verify-mental-models.mjs
 *   node scripts/verify-mental-models.mjs --lang=es
 */
import { existsSync, readdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import yaml from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const modelsDir = join(root, "mental-models");

const REQUIRED_FIELDS = [
  "id",
  "name",
  "quick_introduction",
  "in_more_detail",
  "why_this_is_important",
  "when_to_use",
  "how_can_you_spot_it",
  "examples",
  "real_world_implications",
  "professional_application",
  "how_can_this_be_misapplied",
  "related_content",
];

function isNonEmptyString(v) {
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

function validateModel(model, idx, file, idsSet, issues) {
  const at = `mental_models[${idx}]`;

  for (const field of REQUIRED_FIELDS) {
    if (!(field in model)) issues.push({ file, msg: `${at} missing ${field}` });
  }

  if (!isNonEmptyString(model?.id)) {
    issues.push({ file, msg: `${at}.id missing/empty` });
  } else {
    if (!/^[a-z0-9_]+$/.test(model.id)) {
      issues.push({ file, msg: `${at}.id invalid format (${model.id})` });
    }
    if (idsSet.has(model.id)) {
      issues.push({ file, msg: `${at}.id duplicated (${model.id})` });
    }
    idsSet.add(model.id);
  }

  for (const field of ["name", "quick_introduction", "in_more_detail", "why_this_is_important"]) {
    if (!isNonEmptyString(model?.[field])) {
      issues.push({ file, msg: `${at}.${field} missing/empty` });
    }
  }

  if (!Array.isArray(model?.when_to_use) || model.when_to_use.length === 0) {
    issues.push({ file, msg: `${at}.when_to_use missing/non-empty array` });
  } else {
    for (let i = 0; i < model.when_to_use.length; i += 1) {
      if (!isNonEmptyString(model.when_to_use[i])) {
        issues.push({ file, msg: `${at}.when_to_use[${i}] empty/non-string` });
      }
    }
  }

  for (const field of ["how_can_you_spot_it", "examples", "professional_application", "how_can_this_be_misapplied"]) {
    if (!isStringRecord(model?.[field])) {
      issues.push({ file, msg: `${at}.${field} must be object<string,string>` });
    }
  }

  const rwi = model?.real_world_implications;
  if (!(isNonEmptyString(rwi) || isStringRecord(rwi))) {
    issues.push({
      file,
      msg: `${at}.real_world_implications must be non-empty string or object<string,string>`,
    });
  }

  if (!Array.isArray(model?.related_content)) {
    issues.push({ file, msg: `${at}.related_content must be an array` });
  } else {
    for (let i = 0; i < model.related_content.length; i += 1) {
      if (!isNonEmptyString(model.related_content[i])) {
        issues.push({ file, msg: `${at}.related_content[${i}] empty/non-string` });
      }
    }
  }
}

function getTargetFiles() {
  const langArg = process.argv.find((a) => a.startsWith("--lang="));
  const lang = langArg ? langArg.split("=")[1] : null;

  if (lang) {
    return [`mental-models-${lang}.yaml`];
  }

  if (!existsSync(modelsDir)) return [];
  return readdirSync(modelsDir)
    .filter((f) => /^mental-models-[a-z]{2}\.yaml$/i.test(f))
    .sort();
}

function main() {
  const files = getTargetFiles();
  if (files.length === 0) {
    console.error("No consolidated mental model YAML files found in mental-models/.");
    process.exit(1);
  }

  const issues = [];
  let parsedFiles = 0;
  let totalModels = 0;

  for (const file of files) {
    const abs = join(modelsDir, file);
    if (!existsSync(abs)) {
      issues.push({ file, msg: "file not found" });
      continue;
    }

    let parsed;
    try {
      parsed = yaml.parse(readFileSync(abs, "utf8"));
      parsedFiles += 1;
    } catch (err) {
      issues.push({
        file,
        msg: `YAML parse failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }

    const models = parsed?.mental_models;
    if (!Array.isArray(models)) {
      issues.push({ file, msg: "missing mental_models array" });
      continue;
    }

    totalModels += models.length;
    const idsSet = new Set();
    models.forEach((m, i) => validateModel(m, i, file, idsSet, issues));

    // related_content reference check (optional but very helpful)
    for (let i = 0; i < models.length; i += 1) {
      const m = models[i];
      if (!Array.isArray(m?.related_content)) continue;
      for (const rc of m.related_content) {
        if (typeof rc === "string" && rc.trim() && !idsSet.has(rc)) {
          issues.push({
            file,
            msg: `mental_models[${i}].related_content references unknown id (${rc})`,
          });
        }
      }
    }
  }

  console.log(`Checked ${files.length} file(s); parsed ${parsedFiles}; models ${totalModels}.`);
  if (issues.length === 0) {
    console.log("OK: no parse/structure/reference issues found.");
    return;
  }

  console.log(`Found ${issues.length} issue(s):`);
  for (const issue of issues) {
    console.log(`- ${issue.file}: ${issue.msg}`);
  }
  process.exit(1);
}

main();
