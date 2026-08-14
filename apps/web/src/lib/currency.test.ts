import { describe, expect, it } from "vitest";
import { formatARS } from "./currency";

describe("formatARS", () => {
  // Intl.NumberFormat("es-AR", ...) separa el símbolo del monto con un
  // espacio de ancho fijo (U+00A0, no un espacio " " normal) — verificado
  // con los code points reales antes de escribir esto, no a simple vista
  // (los dos se ven idénticos en una terminal).
  const NBSP = " ";

  it("formatea un número entero como pesos argentinos sin decimales", () => {
    expect(formatARS(50000)).toBe(`$${NBSP}50.000`);
  });

  it("redondea decimales — la spec pide precios en números redondos", () => {
    expect(formatARS(1234.99)).toBe(`$${NBSP}1.235`);
  });

  it("formatea cero", () => {
    expect(formatARS(0)).toBe(`$${NBSP}0`);
  });

  it("formatea números negativos (por si algún cálculo intermedio da negativo)", () => {
    expect(formatARS(-500)).toBe(`-$${NBSP}500`);
  });
});
