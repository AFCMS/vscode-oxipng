import { defineConfig } from "rolldown";

export default defineConfig({
  input: "src/extension.ts",
  external: ["vscode", "node:path", "node:child_process"],
  treeshake: true,
  output: [
    {
      format: "esm",
      dir: "dist/main",
      minify: true,
    },
  ],
});
