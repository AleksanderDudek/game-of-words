import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const isAppBuild = process.env.VITE_BUILD_TARGET === "app";

const adsenseSnippet = `<meta name="google-adsense-account" content="ca-pub-5283520709231531">
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5283520709231531"
     crossorigin="anonymous"></script>`;

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/game-of-words/" : "/",
  plugins: [
    react(),
    {
      name: "inject-adsense",
      transformIndexHtml(html) {
        return html.replace("%ADSENSE%", isAppBuild ? "" : adsenseSnippet);
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/ws": {
        target: "ws://localhost:8080",
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist/client",
  },
});
