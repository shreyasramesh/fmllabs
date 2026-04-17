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
        serif: ['"Lora"', '"Georgia"', 'serif'],
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
        neutral: {
          50: "var(--neutral-50)",
          100: "var(--neutral-100)",
          200: "var(--neutral-200)",
          300: "var(--neutral-300)",
          400: "var(--neutral-400)",
          500: "var(--neutral-500)",
          600: "var(--neutral-600)",
          700: "var(--neutral-700)",
          800: "var(--neutral-800)",
          900: "var(--neutral-900)",
          950: "var(--neutral-950)",
        },
        brand: {
          50: "#faf9f5",
          100: "#f5f4ed",
          200: "#e8e6dc",
          300: "#d1cfc5",
          400: "#b0aea5",
          500: "#87867f",
          600: "#5e5d59",
          700: "#4d4c48",
          800: "#30302e",
          900: "#141413",
        },
        /* Claude terracotta accent scale */
        terracotta: {
          light: "#d97757",
          DEFAULT: "#c96442",
          dark: "#b05530",
        },
        /* Claude parchment surface scale */
        parchment: {
          50: "#faf9f5",
          100: "#f5f4ed",
          200: "#e8e6dc",
          300: "#f0eee6",
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
        "slide-in-from-left": {
          from: { opacity: "0", transform: "translateX(-16px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "description-in": {
          from: { opacity: "0", transform: "translateY(-4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "description-out": {
          from: { opacity: "1", transform: "translateY(0)" },
          to: { opacity: "0", transform: "translateY(-4px)" },
        },
        "shooting-star": {
          "0%": { opacity: "1", transform: "translate(0, 0) scaleX(1)" },
          "70%": { opacity: "0.8", transform: "translate(-200px, 200px) scaleX(0.5)" },
          "100%": { opacity: "0", transform: "translate(-250px, 250px) scaleX(0)" },
        },
        "tour-breathe": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.04)" },
        },
        "life-dot-in": {
          from: { opacity: "0", transform: "scale(0)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "life-number-in": {
          from: { opacity: "0", transform: "translateY(12px) scale(0.95)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "life-hero-flip": {
          "0%": { opacity: "1", transform: "rotateX(0deg) scale(1)" },
          "40%": { opacity: "0", transform: "rotateX(90deg) scale(0.92)" },
          "60%": { opacity: "0", transform: "rotateX(-90deg) scale(0.92)" },
          "100%": { opacity: "1", transform: "rotateX(0deg) scale(1)" },
        },
        "life-glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 6px 2px rgba(201,100,66,0.35)" },
          "50%": { boxShadow: "0 0 14px 4px rgba(201,100,66,0.55)" },
        },
        "life-card-in": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "life-quote-in": {
          from: { opacity: "0", transform: "translateX(20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "life-quote-out": {
          from: { opacity: "1", transform: "translateX(0)" },
          to: { opacity: "0", transform: "translateX(-20px)" },
        },
        "life-progress-fill": {
          from: { width: "0%" },
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
        "slide-in-from-left": "slide-in-from-left 0.45s cubic-bezier(0.4,0,0.2,1) forwards",
        "description-in": "description-in 0.2s ease-out forwards",
        "description-out": "description-out 0.2s ease-out forwards",
        "shooting-star": "shooting-star 1.2s ease-out forwards",
        "tour-breathe": "tour-breathe 2s ease-in-out infinite",
        "life-dot-in": "life-dot-in 0.3s cubic-bezier(0.34,1.56,0.64,1) both",
        "life-number-in": "life-number-in 0.5s cubic-bezier(0.22,1,0.36,1) both",
        "life-hero-flip": "life-hero-flip 0.5s cubic-bezier(0.4,0,0.2,1) both",
        "life-glow-pulse": "life-glow-pulse 2.5s ease-in-out infinite",
        "life-card-in": "life-card-in 0.45s cubic-bezier(0.22,1,0.36,1) both",
        "life-quote-in": "life-quote-in 0.3s ease-out both",
        "life-quote-out": "life-quote-out 0.2s ease-in both",
        "life-progress-fill": "life-progress-fill 1s cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
} satisfies Config;
