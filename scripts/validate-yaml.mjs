#!/usr/bin/env node
/** Validate consolidated mental model YAML file for a given language. */
import fs from "fs";
import path from "path";
import yaml from "yaml";

const root = process.cwd();
const lang = process.argv[2] || "en";
const filePath = path.join(root, "mental-models", `mental-models-${lang}.yaml`);
if (!fs.existsSync(filePath)) {
  console.error("File not found: mental-models/mental-models-" + lang + ".yaml");
  process.exit(1);
}
try {
  const content = fs.readFileSync(filePath, "utf-8");
  const parsed = yaml.parse(content);
  const models = parsed?.mental_models ?? [];
  let failed = 0;
  for (const m of models) {
    if (!m?.id) {
      console.error("FAIL: model missing id", JSON.stringify(m).slice(0, 80));
      failed++;
    }
  }
  console.log(failed ? `\n${failed} models failed` : `All OK (${models.length} models)`);
} catch (e) {
  console.error("FAIL:", e.message?.split("\n")[0]);
  process.exit(1);
}
