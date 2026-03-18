#!/usr/bin/env node
/**
 * Writes lib/version.generated.ts with Major.Minor.Daily version.
 * Major.Minor from package.json; Daily from git rev-list --count HEAD.
 */
import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const parts = pkg.version.split(".").map(Number);
const major = parts[0] ?? 0;
const minor = parts[1] ?? 1;

let daily = 0;
try {
  daily = parseInt(execSync("git rev-list --count HEAD", { cwd: root }).toString().trim(), 10);
} catch {
  daily = 0;
}

const version = `${major}.${minor}.${daily}`;

writeFileSync(
  join(root, "lib", "version.generated.ts"),
  `// Auto-generated at build time. Do not edit.
export const APP_VERSION = "${version}";
`
);

console.log(`Version: ${version}`);
