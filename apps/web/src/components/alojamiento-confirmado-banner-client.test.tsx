import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Reserva } from "@turismo-marcuzzi/shared-types";
import { AlojamientoConfirmadoBannerClient } from "./alojamiento-confirmado-banner-client";

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
  window.localStorage.clear();
});

describe("AlojamientoConfirmadoBannerClient", () => {
  it("sin reservas, no renderiza nada", () => {
    const { container } = render(<AlojamientoConfirmadoBannerClient reservas={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("muestra un aviso de confirmación con el nombre del alojamiento y un link a experiencias", () => {
    render(<AlojamientoConfirmadoBannerClient reservas={[reserva()]} />);
    expect(screen.getByText(/de Depto Península fue confirmado/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver servicios disponibles" })).toHaveAttribute(
      "href",
      "/experiencias",
    );
  });

  it("cerrar el aviso lo oculta para siempre en este navegador", () => {
    render(<AlojamientoConfirmadoBannerClient reservas={[reserva({ id: "r-9" })]} />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    expect(screen.queryByText(/fue confirmado/)).not.toBeInTheDocument();
    expect(window.localStorage.getItem("tm.notificaciones.cerradas")).toContain("banner-confirmado:r-9");
  });
});
