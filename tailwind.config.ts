import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        night: "#07111f",
        ink: "#0b1728",
        panel: "rgba(12, 28, 48, 0.72)",
        gold: "#d6b25e",
        goldSoft: "#f0d990",
        cyanSoft: "#7dd3fc"
      },
      boxShadow: {
        glow: "0 0 36px rgba(214, 178, 94, 0.14)",
        panel: "0 18px 48px rgba(0, 0, 0, 0.24)"
      }
    }
  },
  plugins: []
};

export default config;
