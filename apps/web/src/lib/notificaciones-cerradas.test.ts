import { beforeEach, describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { marcarCerrada, useCerradas } from "./notificaciones-cerradas";

// Cada test usa una clave única (en vez de limpiar localStorage entre
// tests) porque el módulo mantiene estado a nivel de módulo (`snapshot`,
// ver comentario ahí sobre por qué no puede ser un array literal nuevo en
// cada snapshot) — reiniciarlo entre tests requeriría mockear el módulo
// entero, más costoso que simplemente no reusar claves.
beforeEach(() => {
  window.localStorage.clear();
});

describe("marcarCerrada / useCerradas", () => {
  it("una clave no marcada no aparece como cerrada", () => {
    const { result } = renderHook(() => useCerradas());
    expect(result.current.has("banner-confirmado:nunca-marcada")).toBe(false);
  });

  it("marcarCerrada agrega la clave y useCerradas la refleja", () => {
    const { result } = renderHook(() => useCerradas());

    act(() => {
      marcarCerrada("banner-confirmado:test-1");
    });

    expect(result.current.has("banner-confirmado:test-1")).toBe(true);
  });

  it("persiste en localStorage", () => {
    act(() => {
      marcarCerrada("banner-confirmado:test-2");
    });

    const raw = window.localStorage.getItem("tm.notificaciones.cerradas");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toContain("banner-confirmado:test-2");
  });

  it("marcar la misma clave dos veces no la duplica", () => {
    act(() => {
      marcarCerrada("banner-confirmado:test-3");
      marcarCerrada("banner-confirmado:test-3");
    });

    const raw = window.localStorage.getItem("tm.notificaciones.cerradas");
    const claves = JSON.parse(raw as string) as string[];
    expect(claves.filter((c) => c === "banner-confirmado:test-3")).toHaveLength(1);
  });

  it("claves distintas (banner vs. panel de una misma reserva) son independientes", () => {
    const { result } = renderHook(() => useCerradas());

    act(() => {
      marcarCerrada("banner-confirmado:reserva-x");
    });

    expect(result.current.has("banner-confirmado:reserva-x")).toBe(true);
    expect(result.current.has("bell:reserva-x")).toBe(false);
  });
});
