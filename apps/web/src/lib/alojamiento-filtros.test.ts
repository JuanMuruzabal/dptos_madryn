import { describe, expect, it } from "vitest";
import { parseAlojamientoFiltros } from "./alojamiento-filtros";

describe("parseAlojamientoFiltros", () => {
  it("devuelve un objeto vacío sin searchParams", () => {
    expect(parseAlojamientoFiltros({})).toEqual({});
  });

  it("parsea un rango de fechas válido", () => {
    const filtros = parseAlojamientoFiltros({ fecha_inicio: "2026-09-01", fecha_fin: "2026-09-05" });
    expect(filtros.fechaInicio).toBe("2026-09-01");
    expect(filtros.fechaFin).toBe("2026-09-05");
  });

  it("ignora el rango si fecha_fin no es posterior a fecha_inicio", () => {
    const filtros = parseAlojamientoFiltros({ fecha_inicio: "2026-09-05", fecha_fin: "2026-09-01" });
    expect(filtros.fechaInicio).toBeUndefined();
    expect(filtros.fechaFin).toBeUndefined();
  });

  it("ignora el rango si falta una de las dos fechas", () => {
    expect(parseAlojamientoFiltros({ fecha_inicio: "2026-09-01" }).fechaInicio).toBeUndefined();
    expect(parseAlojamientoFiltros({ fecha_fin: "2026-09-05" }).fechaFin).toBeUndefined();
  });

  it("ignora fechas con formato inválido", () => {
    const filtros = parseAlojamientoFiltros({ fecha_inicio: "01-09-2026", fecha_fin: "2026-09-05" });
    expect(filtros.fechaInicio).toBeUndefined();
  });

  it("parsea huespedes como entero positivo", () => {
    expect(parseAlojamientoFiltros({ huespedes: "4" }).huespedes).toBe(4);
  });

  it("ignora huespedes no numérico, cero o negativo", () => {
    expect(parseAlojamientoFiltros({ huespedes: "no-es-numero" }).huespedes).toBeUndefined();
    expect(parseAlojamientoFiltros({ huespedes: "0" }).huespedes).toBeUndefined();
    expect(parseAlojamientoFiltros({ huespedes: "-2" }).huespedes).toBeUndefined();
    expect(parseAlojamientoFiltros({ huespedes: "2.5" }).huespedes).toBeUndefined();
  });

  it("parsea precio_min y precio_max", () => {
    const filtros = parseAlojamientoFiltros({ precio_min: "10000", precio_max: "50000" });
    expect(filtros.precioMin).toBe(10000);
    expect(filtros.precioMax).toBe(50000);
  });

  it("acepta precio_min en 0", () => {
    expect(parseAlojamientoFiltros({ precio_min: "0" }).precioMin).toBe(0);
  });

  it("ignora precio_min/precio_max ausentes o inválidos", () => {
    expect(parseAlojamientoFiltros({}).precioMin).toBeUndefined();
    expect(parseAlojamientoFiltros({ precio_min: "no-es-numero" }).precioMin).toBeUndefined();
    expect(parseAlojamientoFiltros({ precio_max: "-100" }).precioMax).toBeUndefined();
  });

  it("cuando searchParams trae un array, usa el primer valor", () => {
    const filtros = parseAlojamientoFiltros({ huespedes: ["3", "5"] });
    expect(filtros.huespedes).toBe(3);
  });
});
