import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import sonarjs from "eslint-plugin-sonarjs";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores(["**/dist/**", "**/node_modules/**", "docs/**", ".agents/**", "**/*.d.ts"]),
  js.configs.recommended,
  tseslint.configs.recommended,
  sonarjs.configs.recommended,
);
