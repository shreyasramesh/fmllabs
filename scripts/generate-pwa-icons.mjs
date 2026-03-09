#!/usr/bin/env node
/**
 * Generates PWA icons (192x192 and 512x512) from the source SVG.
 * Run: node scripts/generate-pwa-icons.mjs
 */
import sharp from "sharp";
import { readFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const svgPath = join(root, "public", "icon.svg");
const outDir = join(root, "public", "icons");

const svg = readFileSync(svgPath);
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

for (const size of [192, 512]) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(join(outDir, `icon-${size}.png`));
  console.log(`Generated icon-${size}.png`);
}
