import { describe, expect, it } from "vitest";
import { categories, getCategory } from "./categories";

describe("categories", () => {
  it("tiene las 4 categorías del negocio", () => {
    expect(categories.map((c) => c.slug).sort()).toEqual(
      ["alojamiento", "experiencias", "servicio-turistico", "traslados"].sort(),
    );
  });
});

describe("getCategory", () => {
  it("devuelve la categoría por slug", () => {
    expect(getCategory("alojamiento").title).toBe("Alojamiento");
  });

  it("tira un error legible con un slug desconocido", () => {
    expect(() => getCategory("no-existe")).toThrow(/no-existe/);
  });
});
