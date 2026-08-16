import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Reserva } from "@turismo-marcuzzi/shared-types";
import { EsperandoConfirmacionBanner } from "./esperando-confirmacion-banner";

const { fetchMisReservas, getSessionToken } = vi.hoisted(() => ({
  fetchMisReservas: vi.fn(),
  getSessionToken: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ fetchMisReservas }));
vi.mock("@/lib/session", () => ({ getSessionToken }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

function reserva(overrides: Partial<Reserva> = {}): Reserva {
  return {
    id: "r-1",
    tipo: "alojamiento",
    estado: "pendiente",
    fechaInicio: "2026-09-01",
    fechaFin: "2026-09-05",
    total: 1000,
    contactoNombre: "Ana",
    contactoApellido: "Gómez",
    contactoDni: "1",
    contactoEmail: "a@a.com",
    contactoTelefono: "1",
    contactado: true,
    vigente: false,
    expiraEn: new Date(Date.now() + 3_600_000).toISOString(),
    ...overrides,
  } as Reserva;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EsperandoConfirmacionBanner", () => {
  it("sin sesión, no renderiza nada", async () => {
    getSessionToken.mockResolvedValue(null);
    const { container } = render((await EsperandoConfirmacionBanner()) as React.ReactElement);
    expect(container).toBeEmptyDOMElement();
  });

  it("sin reservas esperando confirmación, no renderiza nada", async () => {
    getSessionToken.mockResolvedValue("token");
    fetchMisReservas.mockResolvedValue([reserva({ contactado: false })]);
    const { container } = render((await EsperandoConfirmacionBanner()) as React.ReactElement);
    expect(container).toBeEmptyDOMElement();
  });

  it("con una reserva contactada, renderiza la franja de espera", async () => {
    getSessionToken.mockResolvedValue("token");
    fetchMisReservas.mockResolvedValue([reserva({ contactado: true })]);
    render((await EsperandoConfirmacionBanner()) as React.ReactElement);
    expect(screen.getByText(/Esperando confirmación de tu reserva/)).toBeInTheDocument();
  });
});
