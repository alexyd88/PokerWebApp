import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  optimizeDeps: {
    include: ["game_logic"],
  },
  // optimizeDeps: {
  //   exclude: ["game_logic"],
  // },
  plugins: [react()],

  base: "https://alexyd88.github.io/",

  // build: {
  //   commonjsOptions: { include: [/game_logic/, /node_modules/] },
  //   // commonjsOptions: { },                               // Edit:
  // },
});
