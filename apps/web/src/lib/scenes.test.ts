import { describe, expect, it } from "vitest";
import { aplicarOverridesEscenas, heroScenes, type Scene } from "./scenes";

describe("heroScenes", () => {
  it("todas las escenas fijas tienen una clave estable", () => {
    for (const scene of heroScenes) {
      expect(scene.clave).toBeTruthy();
    }
  });
});

describe("aplicarOverridesEscenas", () => {
  const escenas: Scene[] = [
    { clave: "a", place: "A", caption: "Caption A", gradient: "grad-a" },
    { clave: "b", place: "B", caption: "Caption B", gradient: "grad-b" },
    { place: "Sin clave", caption: "Sin clave", gradient: "grad-c" }, // tarjeta de alojamiento, sin clave
  ];

  it("aplica el override de imagen a la escena con esa clave", () => {
    const overrides = new Map([["a", "https://cdn.example.com/a.jpg"]]);
    const resultado = aplicarOverridesEscenas(escenas, overrides);
    expect(resultado[0].image).toBe("https://cdn.example.com/a.jpg");
  });

  it("no toca escenas sin override para su clave", () => {
    const overrides = new Map([["a", "https://cdn.example.com/a.jpg"]]);
    const resultado = aplicarOverridesEscenas(escenas, overrides);
    expect(resultado[1].image).toBeUndefined();
  });

  it("no revienta con una escena sin clave (tarjeta de alojamiento)", () => {
    const overrides = new Map([["a", "https://cdn.example.com/a.jpg"]]);
    const resultado = aplicarOverridesEscenas(escenas, overrides);
    expect(resultado[2].image).toBeUndefined();
  });

  it("sin overrides, devuelve las escenas sin cambios", () => {
    const resultado = aplicarOverridesEscenas(escenas, new Map());
    expect(resultado).toEqual(escenas);
  });
});
