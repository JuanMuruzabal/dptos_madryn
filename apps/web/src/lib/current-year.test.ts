import { describe, expect, it, vi } from "vitest";

// next/cache (cacheLife, la directiva "use cache") solo existe en el
// runtime real de Next.js — bajo Vitest no hay compilador de Next
// procesando "use cache", así que cacheLife necesita un mock; la
// directiva en sí queda como un string literal inerte, sin efecto.
vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
}));

describe("getCurrentYear", () => {
  it("devuelve el año actual", async () => {
    const { getCurrentYear } = await import("./current-year");
    expect(await getCurrentYear()).toBe(new Date().getFullYear());
  });
});
