#!/usr/bin/env node
/**
 * Verifies all perspective deck YAML files for parse + basic structure.
 *
 * Checks:
 * - YAML parseability
 * - Deck file required fields: id, name, domain, cards
 * - Card required fields: id, name, prompt, follow_ups
 * - follow_ups entries are non-empty strings
 * - Index file contains a non-empty `decks` array
 *
 * Usage:
 *   node scripts/verify-perspective-decks.mjs
 */
import { readdirSync, readFileSync } from "fs";
import { join, relative } from "path";
import { fileURLToPath } from "url";
import yaml from "yaml";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..");
const decksDir = join(root, "perspective-decks");

function collectYamlFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectYamlFiles(abs, out);
    } else if (entry.isFile() && entry.name.endsWith(".yaml")) {
      out.push(relative(root, abs));
    }
  }
  return out;
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function main() {
  const files = collectYamlFiles(decksDir).sort();
  const issues = [];
  let parsedCount = 0;

  for (const relPath of files) {
    const absPath = join(root, relPath);
    const raw = readFileSync(absPath, "utf8");
    let doc;
    try {
      doc = yaml.parse(raw);
      parsedCount += 1;
    } catch (err) {
      issues.push({
        file: relPath,
        type: "yaml-parse",
        msg: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    const isIndex =
      relPath.endsWith("perspective-decks-index.yaml") ||
      /perspective-decks-index-[a-z]{2}\.yaml$/.test(relPath.replace(/\\/g, "/"));
    if (isIndex) {
      if (!Array.isArray(doc?.decks) || doc.decks.length === 0) {
        issues.push({
          file: relPath,
          type: "structure",
          msg: "index missing non-empty decks array",
        });
      }
      continue;
    }

    if (!hasText(doc?.id)) issues.push({ file: relPath, type: "structure", msg: "missing id" });
    if (!hasText(doc?.name)) issues.push({ file: relPath, type: "structure", msg: "missing name" });
    if (!hasText(doc?.domain)) issues.push({ file: relPath, type: "structure", msg: "missing domain" });

    if (!Array.isArray(doc?.cards) || doc.cards.length === 0) {
      issues.push({
        file: relPath,
        type: "structure",
        msg: "missing/non-empty cards array",
      });
      continue;
    }

    doc.cards.forEach((card, i) => {
      const at = `cards[${i}]`;
      if (!hasText(card?.id)) issues.push({ file: relPath, type: "structure", msg: `${at} missing id` });
      if (!hasText(card?.name)) issues.push({ file: relPath, type: "structure", msg: `${at} missing name` });
      if (!hasText(card?.prompt)) issues.push({ file: relPath, type: "structure", msg: `${at} missing prompt` });

      if (!Array.isArray(card?.follow_ups) || card.follow_ups.length === 0) {
        issues.push({
          file: relPath,
          type: "structure",
          msg: `${at} missing/non-empty follow_ups`,
        });
      } else {
        card.follow_ups.forEach((item, j) => {
          if (!hasText(item)) {
            issues.push({
              file: relPath,
              type: "structure",
              msg: `${at}.follow_ups[${j}] empty/non-string`,
            });
          }
        });
      }
    });
  }

  console.log(`Checked ${files.length} YAML files; parsed ${parsedCount}.`);
  if (issues.length === 0) {
    console.log("OK: no parse/structure issues found.");
    return;
  }

  console.log(`Found ${issues.length} issue(s):`);
  for (const issue of issues) {
    console.log(`- [${issue.type}] ${issue.file}: ${issue.msg}`);
  }
  process.exitCode = 1;
}

main();
