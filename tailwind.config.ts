import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Brand accents — RGB triplets in CSS vars so each fund can swap them
        // via Settings → Branding (writes to organizations.theme_json, the GP
        // layout injects --c-navy / --c-teal / --c-gold overrides). Defaults
        // baked into globals.css.
        navy: {
          DEFAULT: "rgb(var(--c-navy) / <alpha-value>)",
          50:      "rgb(var(--c-navy-50) / <alpha-value>)",
          600:     "rgb(var(--c-navy-600) / <alpha-value>)",
          700:     "rgb(var(--c-navy-700) / <alpha-value>)",
        },
        teal: {
          DEFAULT: "rgb(var(--c-teal) / <alpha-value>)",
          50:      "rgb(var(--c-teal-50) / <alpha-value>)",
          600:     "rgb(var(--c-teal-600) / <alpha-value>)",
        },
        gold: {
          DEFAULT: "rgb(var(--c-gold) / <alpha-value>)",
          50:      "rgb(var(--c-gold-50) / <alpha-value>)",
          600:     "rgb(var(--c-gold-600) / <alpha-value>)",
        },
        coral: "#EF4444",
        // Surface tokens — driven by CSS vars defined in globals.css.
        ink:     "rgb(var(--c-ink) / <alpha-value>)",
        paper:   "rgb(var(--c-paper) / <alpha-value>)",
        paper2:  "rgb(var(--c-paper2) / <alpha-value>)",
        line:    "rgb(var(--c-line) / <alpha-value>)",
        muted:   "rgb(var(--c-muted) / <alpha-value>)",
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'serif'],
        sans:  ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card:  "0 1px 2px rgba(10,31,68,0.04), 0 4px 12px rgba(10,31,68,0.06)",
        cardHover: "0 2px 4px rgba(10,31,68,0.06), 0 8px 24px rgba(10,31,68,0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
