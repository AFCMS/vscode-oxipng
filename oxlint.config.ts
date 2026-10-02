import { defineConfig } from "oxlint";

export default defineConfig({
  options: {
    typeAware: true,
  },
  rules: {
    "oxc/no-barrel-file": "error",
  },
  ignorePatterns: [
    "**/node_modules/**",
    "**/dist/**",
    "**/out/**",
    "**/.git/**",
    "src/types/git.d.ts",
  ],
});
