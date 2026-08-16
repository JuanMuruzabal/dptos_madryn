import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Reserva } from "@turismo-marcuzzi/shared-types";
import { ReservaBannerClient } from "./reserva-banner-client";

const { marcarContactadoAction, refresh } = vi.hoisted(() => ({
  marcarContactadoAction: vi.fn(async () => {}),
  refresh: vi.fn(),
}));
vi.mock("@/app/actions/reservas", () => ({ marcarContactadoAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

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
    vigente: false,
    expiraEn: new Date(Date.now() + 60_000).toISOString(),
    alojamiento: { id: "a-1", nombre: "Depto Península" },
    ...overrides,
  } as Reserva;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ReservaBannerClient", () => {
  it("muestra el mensaje con el nombre del alojamiento y la cuenta regresiva", () => {
    render(<ReservaBannerClient reserva={reserva()} />);
    expect(screen.getByText(/de Depto Península/)).toBeInTheDocument();
  });

  it("sin alojamiento asociado, el mensaje omite el nombre", () => {
    render(<ReservaBannerClient reserva={reserva({ alojamiento: undefined })} />);
    expect(screen.getByText(/Contactate para no perder tu reserva —/)).toBeInTheDocument();
  });

  it("cerrar el banner lo oculta", () => {
    const { container } = render(<ReservaBannerClient reserva={reserva()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    expect(container).toBeEmptyDOMElement();
  });

  it("tocar WhatsApp marca como contactada, refresca y pasa al aviso de 'revisá notificaciones'", async () => {
    render(<ReservaBannerClient reserva={reserva()} />);
    fireEvent.click(screen.getByRole("link", { name: "WhatsApp" }));

    expect(await screen.findByText(/Revisá notificaciones/)).toBeInTheDocument();
    await waitFor(() => expect(marcarContactadoAction).toHaveBeenCalledWith("r-1"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("tocar Mail también dispara el mismo flujo de contacto", async () => {
    render(<ReservaBannerClient reserva={reserva()} />);
    fireEvent.click(screen.getByRole("link", { name: "Mail" }));
    expect(await screen.findByText(/Revisá notificaciones/)).toBeInTheDocument();
  });

  it("cerrar el aviso de 'revisá notificaciones' lo oculta", async () => {
    const { container } = render(<ReservaBannerClient reserva={reserva()} />);
    fireEvent.click(screen.getByRole("link", { name: "WhatsApp" }));
    await screen.findByText(/Revisá notificaciones/);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    expect(container).toBeEmptyDOMElement();
  });
});
