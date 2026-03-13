#!/usr/bin/env node
/**
 * Fix YAML parse errors caused by list items with quoted substrings followed by more text.
 * Pattern: `  - "partial" rest of text` -> `  - partial rest of text`
 * Also fixes: `  -text` (missing space) -> `  - text`
 */
import fs from "fs";
import path from "path";

const root = process.cwd();
const dirs = ["mental-models", "perspective-decks"];

let fixed = 0;
for (const dir of dirs) {
  const dirPath = path.join(root, dir);
  if (!fs.existsSync(dirPath)) continue;
  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".yaml"));
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    let content = fs.readFileSync(filePath, "utf-8");
    let changed = false;
    const lines = content.split("\n");
    const newLines = lines.map((line) => {
      // Fix: "xxx" yyy -> xxx yyy (list item with quoted substring + more text)
      const listQuotedMatch = line.match(/^(\s{2})- "([^"]*)"(\s*.+)$/);
      if (listQuotedMatch) {
        changed = true;
        return listQuotedMatch[1] + "- " + listQuotedMatch[2] + listQuotedMatch[3];
      }
      // Fix: -xxx (missing space after dash)
      const noSpaceMatch = line.match(/^(\s{2})-([^\s-].*)$/);
      if (noSpaceMatch) {
        changed = true;
        return noSpaceMatch[1] + "- " + noSpaceMatch[2];
      }
      return line;
    });
    if (changed) {
      fs.writeFileSync(filePath, newLines.join("\n"), "utf-8");
      fixed++;
      console.log("Fixed:", path.join(dir, file));
    }
  }
}
console.log("Total files fixed:", fixed);
