import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Bloqueo } from "@turismo-marcuzzi/shared-types";
import { BloqueosManager } from "./bloqueos-manager";

const { crearBloqueoAction, eliminarBloqueoAction, refresh } = vi.hoisted(() => ({
  crearBloqueoAction: vi.fn(async () => ({})),
  eliminarBloqueoAction: vi.fn(async () => {}),
  refresh: vi.fn(),
}));
vi.mock("@/app/actions/admin", () => ({ crearBloqueoAction, eliminarBloqueoAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

function bloqueo(overrides: Partial<Bloqueo> = {}): Bloqueo {
  return { id: "b-1", fechaInicio: "2026-09-01", fechaFin: "2026-09-05", motivo: "Mantenimiento", ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BloqueosManager", () => {
  it("sin bloqueos, no muestra la lista", () => {
    render(<BloqueosManager alojamientoId="a-1" bloqueos={[]} />);
    expect(screen.queryByRole("button", { name: "Liberar" })).not.toBeInTheDocument();
  });

  it("con bloqueos, muestra el rango y el motivo de cada uno", () => {
    render(<BloqueosManager alojamientoId="a-1" bloqueos={[bloqueo()]} />);
    expect(screen.getByText(/2026-09-01/)).toBeInTheDocument();
    expect(screen.getByText(/Mantenimiento/)).toBeInTheDocument();
  });

  it("un bloqueo sin motivo no muestra el separador de motivo", () => {
    render(<BloqueosManager alojamientoId="a-1" bloqueos={[bloqueo({ motivo: "" })]} />);
    expect(screen.queryByText(/—/)).not.toBeInTheDocument();
  });

  it("clickear Liberar elimina el bloqueo y refresca", async () => {
    render(<BloqueosManager alojamientoId="a-1" bloqueos={[bloqueo({ id: "b-9" })]} />);
    fireEvent.click(screen.getByRole("button", { name: "Liberar" }));
    await waitFor(() => expect(eliminarBloqueoAction).toHaveBeenCalledWith("a-1", "b-9"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("muestra el error del backend al crear un bloqueo", async () => {
    crearBloqueoAction.mockResolvedValue({ error: "El rango se superpone con una reserva existente." });
    render(<BloqueosManager alojamientoId="a-1" bloqueos={[]} />);
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-09-05" } });
    fireEvent.click(screen.getByRole("button", { name: "Bloquear" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("se superpone con una reserva");
  });
});
