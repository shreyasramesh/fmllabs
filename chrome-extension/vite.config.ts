import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { readFileSync, existsSync } from "fs";

const rootDir = resolve(__dirname, "..");
const env = loadEnv("production", rootDir, "");

// Fallback: read .env.local directly if loadEnv didn't pick it up
function loadEnvLocal(): Record<string, string> {
  const envLocalPath = resolve(rootDir, ".env.local");
  if (!existsSync(envLocalPath)) return {};
  try {
    const content = readFileSync(envLocalPath, "utf-8");
    const out: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) out[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    return {};
  }
}
const envLocal = loadEnvLocal();

const API_BASE =
  env.API_BASE || envLocal.API_BASE || process.env.API_BASE || "https://fmllabs.ai";
const isStoreBuild =
  (env.CHROME_STORE_BUILD || envLocal.CHROME_STORE_BUILD || process.env.CHROME_STORE_BUILD || "")
    .toLowerCase() === "true";
const CLERK_PUBLISHABLE_KEY =
  env.CLERK_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  envLocal.CLERK_PUBLISHABLE_KEY ||
  envLocal.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  process.env.CLERK_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  "";

if (!CLERK_PUBLISHABLE_KEY) {
  console.warn(
    "⚠ CLERK_PUBLISHABLE_KEY is empty. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in .env.local (project root) or pass CLERK_PUBLISHABLE_KEY when building."
  );
}

export default defineConfig({
  base: "./",
  envDir: rootDir,
  plugins: [
    react(),
    {
      name: "copy-manifest",
      closeBundle() {
        const fs = require("fs");
        const path = require("path");
        const distDir = path.resolve(__dirname, "dist");
        if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
        const manifest = JSON.parse(
          fs.readFileSync(path.resolve(__dirname, "manifest.json"), "utf8")
        );
        if (isStoreBuild) {
          // Strip local dev hosts for Chrome Web Store submissions.
          manifest.host_permissions = (manifest.host_permissions || []).filter(
            (host: string) =>
              host !== "http://localhost:3000/*" &&
              host !== "http://127.0.0.1:3000/*"
          );
        }
        manifest.action.default_popup = "popup/popup.html";
        manifest.side_panel.default_path = "sidepanel/sidepanel.html";
        fs.writeFileSync(
          path.resolve(distDir, "manifest.json"),
          JSON.stringify(manifest, null, 2)
        );
      },
    },
  ],
  define: {
    __API_BASE__: JSON.stringify(API_BASE),
    __CLERK_PUBLISHABLE_KEY__: JSON.stringify(CLERK_PUBLISHABLE_KEY),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup/popup.html"),
        sidepanel: resolve(__dirname, "sidepanel/sidepanel.html"),
        background: resolve(__dirname, "background/service-worker.ts"),
        content: resolve(__dirname, "content/content.ts"),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "background") return "background.js";
          if (chunk.name === "content") return "content.js";
          return "[name].js";
        },
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
    sourcemap: true,
  },
  publicDir: "public",
});
