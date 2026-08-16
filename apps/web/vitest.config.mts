import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// T12.14 (docs/implementation-plan.md §12.3) — Vitest en vez de Jest,
// decisión registrada en docs/tradeoffs.md TR-039. El alias @/* replica el
// de tsconfig.json (paths) porque Vitest no lo lee solo.
//
// Extensión .mts (no .ts): apps/web/package.json no tiene "type": "module"
// (Next.js espera CJS por default) — sin la extensión explícita, el
// configLoader nativo de Vite carga este archivo como CommonJS pese a su
// sintaxis ESM y tira un warning en cada corrida.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // `include` explícito (no solo `exclude`) es lo que hace que el
      // reporte cuente TODO src/, no solo los archivos que algún test
      // llegó a importar — sin esto, un archivo entero sin ningún test ni
      // se menciona, lo que infla el % de cobertura de forma engañosa.
      // Vitest 4 sacó la opción `all` (viejo v8/istanbul) — `include` solo
      // ya alcanza. El 80% de abajo aplica sobre TODO el alcance real
      // (T12.15-T12.18 todavía no están completos acá — es normal y
      // esperado que el número total esté bajo hasta terminarlos, mismo
      // criterio que se usó para medir el backend paquete por paquete en
      // T12.1-T12.13).
      include: ["src/**/*.{ts,tsx}"],
      // TR-040: los Server Components async (page.tsx/layout.tsx, casi
      // todo apps/web/src/app con Cache Components — TR-008) no son
      // unit-testeables de forma estándar (Testing Library necesita
      // componentes cliente/síncronos, no funciones async que devuelven
      // JSX del lado del servidor) — quedan mejor cubiertos por QA
      // end-to-end (T5.4) que por unit tests. El 80% de esta fase aplica
      // sobre lo que sí es unit-testeable: lib/, app/actions/ y
      // componentes cliente con lógica real.
      exclude: [
        "src/app/**/page.tsx",
        "src/app/**/layout.tsx",
        "src/**/*.d.ts",
        "**/*.config.*",
        "**/node_modules/**",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
