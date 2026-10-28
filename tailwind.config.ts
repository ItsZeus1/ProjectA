import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  // Promo banner gradients are stored in the database as class strings, so Tailwind
  // cannot discover them by scanning source files. Safelist the palette we allow.
  safelist: [
    {
      pattern:
        /^(from|via|to)-(violet|fuchsia|indigo|purple|pink|rose|red|orange|amber|yellow|emerald|teal|cyan|sky|blue)-(400|500|600|700|800|900)$/,
    },
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      colors: {
        obsidian: "#07080D",
        midnight: "#0B0D17",
      },
    },
  },
  plugins: [],
};

export default config;
