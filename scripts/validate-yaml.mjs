#!/usr/bin/env node
/** Validate all mental model YAML files for a given language. */
import fs from "fs";
import path from "path";
import yaml from "yaml";

const root = process.cwd();
const lang = process.argv[2] || "ta";
const indexPath = path.join(root, `mental-models-index-${lang}.yaml`);
if (!fs.existsSync(indexPath)) {
  console.error("Index not found:", indexPath);
  process.exit(1);
}
const index = yaml.parse(fs.readFileSync(indexPath, "utf-8"));
const baseDir = path.dirname(index.mental_models[0]?.path || "mental-models-en/");
const fullBase = path.join(root, baseDir);

let failed = 0;
for (const m of index.mental_models) {
  const filePath = path.join(root, m.path);
  try {
    yaml.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (e) {
    console.error("FAIL:", m.path, e.message?.split("\n")[0]);
    failed++;
  }
}
console.log(failed ? `\n${failed} files failed` : "All OK");
