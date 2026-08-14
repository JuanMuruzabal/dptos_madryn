import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Reserva } from "@turismo-marcuzzi/shared-types";
import { NotificationsBell } from "./notifications-bell";

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
    estado: "confirmada",
    fechaInicio: "2026-09-01",
    fechaFin: "2026-09-05",
    total: 1000,
    contactoNombre: "Ana",
    contactoApellido: "Gómez",
    contactoDni: "1",
    contactoEmail: "a@a.com",
    contactoTelefono: "1",
    contactado: true,
    vigente: true,
    alojamiento: { id: "a-1", nombre: "Depto Península" },
    ...overrides,
  } as Reserva;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NotificationsBell", () => {
  it("sin sesión, no renderiza nada", async () => {
    getSessionToken.mockResolvedValue(null);
    const { container } = render((await NotificationsBell()) as React.ReactElement);
    expect(container).toBeEmptyDOMElement();
  });

  it("sin notificaciones, no renderiza nada", async () => {
    getSessionToken.mockResolvedValue("token");
    fetchMisReservas.mockResolvedValue([reserva({ estado: "cancelada" })]);
    const { container } = render((await NotificationsBell()) as React.ReactElement);
    expect(container).toBeEmptyDOMElement();
  });

  it("con una reserva confirmada, renderiza el ícono de campana", async () => {
    getSessionToken.mockResolvedValue("token");
    fetchMisReservas.mockResolvedValue([reserva()]);
    render((await NotificationsBell()) as React.ReactElement);
    expect(screen.getByRole("button", { name: /Notificaciones/ })).toBeInTheDocument();
  });
});
