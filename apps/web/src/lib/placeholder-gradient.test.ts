import { describe, expect, it } from "vitest";
import { placeholderGradient } from "./placeholder-gradient";

describe("placeholderGradient", () => {
  it("es determinístico: el mismo seed siempre da el mismo gradiente", () => {
    const a = placeholderGradient("alojamiento-123");
    const b = placeholderGradient("alojamiento-123");
    expect(a).toBe(b);
  });

  it("siempre devuelve uno de los gradientes de marca (empieza con linear-gradient)", () => {
    expect(placeholderGradient("cualquier-seed")).toMatch(/^linear-gradient\(/);
  });

  it("distintos seeds pueden dar distinto resultado (no siempre el mismo gradiente fijo)", () => {
    const resultados = new Set(
      ["a", "b", "c", "d", "e", "f", "g", "h"].map((s) => placeholderGradient(s)),
    );
    expect(resultados.size).toBeGreaterThan(1);
  });

  it("no revienta con un seed vacío", () => {
    expect(() => placeholderGradient("")).not.toThrow();
  });
});
