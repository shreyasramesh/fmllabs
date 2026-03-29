import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL ?? "https://www.fmllabs.ai";

const config: CapacitorConfig = {
  appId: "ai.fmllabs.app",
  appName: "FigureMyLife Labs",
  webDir: "public",
  server: {
    url: serverUrl,
    cleartext: false,
    androidScheme: "https",
    allowNavigation: [
      "fmllabs.ai",
      "*.fmllabs.ai",
      "img.clerk.com",
      "js.clerk.com",
      "*.clerk.accounts.dev",
      "*.clerk.dev",
    ],
  },
};

export default config;
