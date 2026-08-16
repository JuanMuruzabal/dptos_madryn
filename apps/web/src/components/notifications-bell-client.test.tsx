import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Reserva } from "@turismo-marcuzzi/shared-types";
import type { NotificacionReserva } from "@/lib/reserva-urgencia";
import { NotificationsBellClient } from "./notifications-bell-client";

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
    alojamiento: { id: "a-1", nombre: "Depto Península" },
    ...overrides,
  } as Reserva;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("NotificationsBellClient", () => {
  it("el botón está cerrado por defecto y sin punto rojo si no hay notificaciones", () => {
    render(<NotificationsBellClient notificaciones={[]} />);
    expect(screen.getByRole("button", { name: "Notificaciones (0)" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("clickear el ícono abre el panel", () => {
    const notif: NotificacionReserva[] = [{ reserva: reserva(), tipo: "esperando_confirmacion" }];
    render(<NotificationsBellClient notificaciones={notif} />);
    fireEvent.click(screen.getByRole("button", { name: "Notificaciones (1)" }));
    expect(screen.getByText("Tus reservas")).toBeInTheDocument();
  });

  it("sin notificaciones abierto, muestra el mensaje de vacío", () => {
    render(<NotificationsBellClient notificaciones={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Notificaciones (0)" }));
    expect(screen.getByText("No tenés notificaciones nuevas.")).toBeInTheDocument();
  });

  it("una notificación 'esperando_confirmacion' muestra la cuenta regresiva y no tiene botón de cerrar", () => {
    const notif: NotificacionReserva[] = [{ reserva: reserva(), tipo: "esperando_confirmacion" }];
    render(<NotificationsBellClient notificaciones={notif} />);
    fireEvent.click(screen.getByRole("button", { name: /Notificaciones/ }));
    expect(screen.getByText(/Esperando confirmación/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cerrar notificación" })).not.toBeInTheDocument();
  });

  it("una notificación 'confirmada' sí tiene botón de cerrar y al tocarlo desaparece", () => {
    const notif: NotificacionReserva[] = [{ reserva: reserva({ estado: "confirmada" }), tipo: "confirmada" }];
    render(<NotificationsBellClient notificaciones={notif} />);
    fireEvent.click(screen.getByRole("button", { name: /Notificaciones/ }));
    expect(screen.getByText(/Se confirmó tu reserva/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar notificación" }));
    expect(screen.getByText("No tenés notificaciones nuevas.")).toBeInTheDocument();
  });

  it("clickear afuera del panel lo cierra", () => {
    const notif: NotificacionReserva[] = [{ reserva: reserva(), tipo: "esperando_confirmacion" }];
    render(<NotificationsBellClient notificaciones={notif} />);
    fireEvent.click(screen.getByRole("button", { name: /Notificaciones/ }));
    expect(screen.getByText("Tus reservas")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("Tus reservas")).not.toBeInTheDocument();
  });
});
