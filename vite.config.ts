import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Vite 8 runs on Rolldown, which replaced the old `rollupOptions.output
    // .manualChunks` object form with `codeSplitting.groups` — split
    // rarely-changing vendor code from app code so a deploy only busts the
    // cache for the chunk that actually changed.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "react", test: /\/node_modules\/(react|react-dom|react-router-dom)\// },
            { name: "query", test: /\/node_modules\/@tanstack\// },
            { name: "realtime", test: /\/node_modules\/(laravel-echo|pusher-js)\// },
            { name: "dates", test: /\/node_modules\/date-fns\// },
          ],
        },
      },
    },
  },
});
