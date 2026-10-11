import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  globalIgnores([
    ".next/**",
    ".local/**",
    "out/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    ".claude/**",
    ".agents/**",
    "skills/**",
    "next-env.d.ts",
  ]),
]);
