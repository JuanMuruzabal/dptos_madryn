import { describe, expect, it } from "vitest";
import type { Reserva } from "@turismo-marcuzzi/shared-types";
import {
  reservaUrgenteBanner,
  reservasConfirmadasVigentes,
  reservasEsperandoConfirmacion,
  reservasParaNotificaciones,
} from "./reserva-urgencia";

function reserva(overrides: Partial<Reserva> = {}): Reserva {
  return {
    id: "r-1",
    tipo: "alojamiento",
    estado: "pendiente",
    fechaInicio: "2026-09-01",
    fechaFin: "2026-09-05",
    total: 50000,
    contactoNombre: "Ana",
    contactoApellido: "Test",
    contactoDni: "12345678",
    contactoEmail: "ana@example.com",
    contactoTelefono: "1122334455",
    contactado: false,
    vigente: false,
    ...overrides,
  };
}

describe("reservaUrgenteBanner", () => {
  it("devuelve null si no hay ninguna pendiente sin contactar", () => {
    expect(reservaUrgenteBanner([])).toBeNull();
    expect(reservaUrgenteBanner([reserva({ estado: "confirmada", vigente: true })])).toBeNull();
    expect(reservaUrgenteBanner([reserva({ contactado: true, expiraEn: "2026-09-01T00:00:00Z" })])).toBeNull();
  });

  it("ignora una pendiente sin expiraEn (no debería pasar, pero por las dudas)", () => {
    expect(reservaUrgenteBanner([reserva({ expiraEn: undefined })])).toBeNull();
  });

  it("devuelve la pendiente sin contactar que vence antes", () => {
    const vencePrimero = reserva({ id: "vence-primero", expiraEn: "2026-09-01T10:00:00Z" });
    const venceDespues = reserva({ id: "vence-despues", expiraEn: "2026-09-01T12:00:00Z" });
    const resultado = reservaUrgenteBanner([venceDespues, vencePrimero]);
    expect(resultado?.id).toBe("vence-primero");
  });

  it("no compite con reservas ya contactadas ni confirmadas", () => {
    const urgente = reserva({ id: "urgente", expiraEn: "2026-09-01T10:00:00Z" });
    const contactada = reserva({ id: "contactada", contactado: true, expiraEn: "2026-08-01T00:00:00Z" });
    const confirmada = reserva({ id: "confirmada", estado: "confirmada", vigente: true });
    const resultado = reservaUrgenteBanner([contactada, confirmada, urgente]);
    expect(resultado?.id).toBe("urgente");
  });
});

describe("reservasEsperandoConfirmacion", () => {
  it("solo incluye pendientes YA contactadas con expiraEn", () => {
    const buena = reserva({ id: "buena", contactado: true, expiraEn: "2026-09-01T00:00:00Z" });
    const sinContactar = reserva({ id: "sin-contactar", contactado: false, expiraEn: "2026-09-01T00:00:00Z" });
    const confirmada = reserva({ id: "confirmada", estado: "confirmada", contactado: true, vigente: true });
    const resultado = reservasEsperandoConfirmacion([buena, sinContactar, confirmada]);
    expect(resultado.map((r) => r.id)).toEqual(["buena"]);
  });

  it("devuelve varias, ordenadas por la que vence antes primero", () => {
    const tarde = reserva({ id: "tarde", contactado: true, expiraEn: "2026-09-02T00:00:00Z" });
    const temprano = reserva({ id: "temprano", contactado: true, expiraEn: "2026-09-01T00:00:00Z" });
    const resultado = reservasEsperandoConfirmacion([tarde, temprano]);
    expect(resultado.map((r) => r.id)).toEqual(["temprano", "tarde"]);
  });
});

describe("reservasConfirmadasVigentes", () => {
  it("solo incluye confirmadas Y vigentes", () => {
    const vigente = reserva({ id: "vigente", estado: "confirmada", vigente: true });
    const noVigente = reserva({ id: "no-vigente", estado: "confirmada", vigente: false });
    const pendiente = reserva({ id: "pendiente", estado: "pendiente", vigente: true });
    const resultado = reservasConfirmadasVigentes([vigente, noVigente, pendiente]);
    expect(resultado.map((r) => r.id)).toEqual(["vigente"]);
  });
});

describe("reservasParaNotificaciones", () => {
  it("excluye canceladas y combina esperando-confirmación + confirmadas, en ese orden", () => {
    const esperando = reserva({ id: "esperando", contactado: true, expiraEn: "2026-09-01T00:00:00Z" });
    const confirmada = reserva({ id: "confirmada", estado: "confirmada", vigente: true });
    const cancelada = reserva({ id: "cancelada", estado: "cancelada" });

    const resultado = reservasParaNotificaciones([confirmada, cancelada, esperando]);

    expect(resultado).toEqual([
      { reserva: esperando, tipo: "esperando_confirmacion" },
      { reserva: confirmada, tipo: "confirmada" },
    ]);
  });

  it("devuelve un array vacío sin reservas activas", () => {
    expect(reservasParaNotificaciones([])).toEqual([]);
    expect(reservasParaNotificaciones([reserva({ estado: "cancelada" })])).toEqual([]);
  });
});
