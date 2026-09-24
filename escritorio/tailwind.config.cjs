/** Tailwind para la versión de escritorio: usa el mismo tema que la web. */
const path = require("path");

module.exports = {
  content: [
    path.join(__dirname, "src/**/*.{ts,tsx}"),
    path.join(__dirname, "../eventos/src/**/*.{ts,tsx}"),
  ],
  theme: {
    extend: {
      colors: {
        choho: {
          red: "#d0342c", redDark: "#a8241e", redLight: "#fdeceb",
          black: "#141414", ink: "#1f1f1f",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(20,20,20,.05), 0 1px 3px rgba(20,20,20,.06)",
        pop: "0 10px 30px rgba(20,20,20,.12)",
      },
      keyframes: {
        fadeUp: { "0%": { opacity: "0", transform: "translateY(6px)" }, "100%": { opacity: "1", transform: "none" } },
        slideIn: { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "none" } },
      },
      animation: { fadeUp: "fadeUp .28s ease-out both", slideIn: "slideIn .22s ease-out both" },
    },
  },
  plugins: [],
};
