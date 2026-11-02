import { defineConfig } from "vite";
export default defineConfig({
  base: "/themes/MD3/dist/",
  server: {
    proxy: process.env.KOMARI_URL
      ? {
          "/api": {
            target: process.env.KOMARI_URL,
            changeOrigin: true,
            ws: true,
          },
        }
      : undefined,
  },
  build: { target: "es2022" },
});
