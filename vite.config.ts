// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repo = "Read-Rise-App";
const isPages = process.env.GITHUB_PAGES === "true";

export default defineConfig({
  plugins: [react()],
  base: isPages ? `/${repo}/` : "/", // Pages vs Vercel
});
