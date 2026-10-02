import { defineConfig } from "oxfmt";

export default defineConfig({
  sortImports: true,
  sortPackageJson: true,
  sortTailwindcss: false,
  ignorePatterns: [
    "**/node_modules/**",
    "**/dist/**",
    "**/out/**",
    "**/.git/**",
    "src/types/git.d.ts",
  ],
});
