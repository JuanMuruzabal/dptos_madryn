import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // T12.14: reporte HTML generado por `vitest run --coverage` — no es
    // código fuente, ya está en .gitignore (/coverage), ESLint tiene que
    // ignorarlo también.
    "coverage/**",
  ]),
]);

export default eslintConfig;
