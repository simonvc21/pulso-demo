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
        // Brand accents — fixed (don't flip in dark mode).
        navy:    { DEFAULT: "#0A1F44", 50: "#E8ECF4", 600: "#1B3A6F", 700: "#0F2A5C" },
        teal:    { DEFAULT: "#14B8A6", 50: "#E8FBF7", 600: "#0E8A7C" },
        gold:    { DEFAULT: "#F4B740", 50: "#FDF6E3", 600: "#D69A1F" },
        coral:   "#EF4444",
        // Surface tokens — driven by CSS vars defined in globals.css.
        // Components keep using `bg-paper`, `text-ink`, etc. and switch
        // automatically when html.dark is set.
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
