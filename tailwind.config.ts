import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        script: ['"Great Vibes"', 'cursive'],
        developer: ['"Pinyon Script"', 'cursive'],
      },
      borderWidth: {
        DEFAULT: "2px",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        accent: "var(--accent)",
        brand: {
          50: "#eef5f4",
          100: "#c5dcd9",
          200: "#9cc3be",
          300: "#73aaa3",
          400: "#4a9188",
          500: "#2a6e66",
          600: "#225a55",
          700: "#1a4641",
          800: "#1A3631",
          900: "#0f1f1d",
        },
      },
      keyframes: {
        blink: {
          "0%, 50%": { opacity: "1" },
          "51%, 100%": { opacity: "0" },
        },
        spin: {
          to: { transform: "rotate(360deg)" },
        },
        dots: {
          "0%, 20%": { opacity: "0" },
          "40%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "bounce-dot": {
          "0%, 60%, 100%": { transform: "translateY(0)" },
          "30%": { transform: "translateY(-4px)" },
        },
        "voice-breathe": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.08)", opacity: "0.9" },
        },
        "voice-hold-hint": {
          "0%, 100%": { opacity: "0.25", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(1.03)" },
        },
        "ghost-run": {
          from: { transform: "translateX(100vw)" },
          to: { transform: "translateX(0)" },
        },
        "incognito-header-bg-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "incognito-header-content-in-light": {
          from: { color: "rgb(23 23 23)" },
          to: { color: "rgb(245 245 245)" },
        },
        "incognito-header-content-in-dark": {
          from: { color: "rgb(250 250 250)" },
          to: { color: "rgb(23 23 23)" },
        },
      },
      animation: {
        blink: "blink 1s step-end infinite",
        spin: "spin 1s linear infinite",
        dots: "dots 1.4s ease-in-out infinite both",
        "fade-in-up": "fade-in-up 0.35s ease-out forwards",
        "fade-in": "fade-in 0.2s ease-out forwards",
        "bounce-dot": "bounce-dot 1.4s ease-in-out infinite both",
        "voice-breathe": "voice-breathe 2s ease-in-out infinite",
        "voice-hold-hint": "voice-hold-hint 2.5s ease-in-out infinite",
        "ghost-run": "ghost-run 1.4s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "incognito-header-bg-in": "incognito-header-bg-in 1.4s ease-out forwards",
        "incognito-header-content-in-light": "incognito-header-content-in-light 1.4s ease-out forwards",
        "incognito-header-content-in-dark": "incognito-header-content-in-dark 1.4s ease-out forwards",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
} satisfies Config;
