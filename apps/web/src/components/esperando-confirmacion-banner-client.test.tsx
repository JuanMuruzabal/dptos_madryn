import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Reserva } from "@turismo-marcuzzi/shared-types";
import { EsperandoConfirmacionBannerClient } from "./esperando-confirmacion-banner-client";

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

describe("EsperandoConfirmacionBannerClient", () => {
  it("sin reservas visibles, no renderiza nada", () => {
    const { container } = render(<EsperandoConfirmacionBannerClient reservas={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("muestra una franja por cada reserva", () => {
    render(
      <EsperandoConfirmacionBannerClient
        reservas={[reserva({ id: "1" }), reserva({ id: "2", alojamiento: { id: "a-2", nombre: "Cabaña Sur" } })]}
      />,
    );
    expect(screen.getAllByText(/Esperando confirmación de tu reserva/)).toHaveLength(2);
    expect(screen.getByText(/de Cabaña Sur/)).toBeInTheDocument();
  });

  it("cerrar una franja la oculta y persiste en localStorage", () => {
    render(<EsperandoConfirmacionBannerClient reservas={[reserva({ id: "r-9" })]} />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    expect(screen.queryByText(/Esperando confirmación/)).not.toBeInTheDocument();
    expect(window.localStorage.getItem("tm.notificaciones.cerradas")).toContain("banner:r-9");
  });
});
