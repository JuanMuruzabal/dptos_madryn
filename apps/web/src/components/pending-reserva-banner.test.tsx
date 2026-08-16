import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Reserva } from "@turismo-marcuzzi/shared-types";
import { PendingReservaBanner } from "./pending-reserva-banner";

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
    contactado: false,
    vigente: true,
    expiraEn: new Date(Date.now() + 60_000).toISOString(),
    ...overrides,
  } as Reserva;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PendingReservaBanner", () => {
  it("sin sesión, no renderiza nada", async () => {
    getSessionToken.mockResolvedValue(null);
    const jsx = await PendingReservaBanner();
    const { container } = render(jsx as React.ReactElement);
    expect(container).toBeEmptyDOMElement();
    expect(fetchMisReservas).not.toHaveBeenCalled();
  });

  it("sin reserva urgente, no renderiza nada", async () => {
    getSessionToken.mockResolvedValue("token");
    fetchMisReservas.mockResolvedValue([reserva({ contactado: true })]);
    const jsx = await PendingReservaBanner();
    const { container } = render(jsx as React.ReactElement);
    expect(container).toBeEmptyDOMElement();
  });

  it("con una reserva pendiente sin contactar, renderiza el banner con la cuenta regresiva", async () => {
    getSessionToken.mockResolvedValue("token");
    fetchMisReservas.mockResolvedValue([reserva({ contactado: false })]);
    const jsx = await PendingReservaBanner();
    render(jsx as React.ReactElement);
    expect(screen.getByText(/Contactate para no perder tu reserva/)).toBeInTheDocument();
  });
});
