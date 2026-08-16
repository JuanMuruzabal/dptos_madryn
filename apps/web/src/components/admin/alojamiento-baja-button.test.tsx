import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Alojamiento } from "@turismo-marcuzzi/shared-types";
import { AlojamientoBajaButton } from "./alojamiento-baja-button";

// vi.hoisted (no un `const` suelto): garantiza que estas referencias
// existan ANTES de que corran las factories de vi.mock de abajo, que
// Vitest hoistea al principio del archivo — sin esto, un `const` normal
// puede quedar en su zona muerta temporal cuando la factory lo lee.
const { darDeBajaAlojamientoAction, activarAlojamientoAction, refresh } = vi.hoisted(() => ({
  darDeBajaAlojamientoAction: vi.fn(),
  activarAlojamientoAction: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/app/actions/admin", () => ({ darDeBajaAlojamientoAction, activarAlojamientoAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

function alojamiento(overrides: Partial<Alojamiento> = {}): Alojamiento {
  return {
    id: "a-1", nombre: "Depto", descripcion: "", lat: 0, lng: 0, direccion: "",
    precioNoche: 1000, capacidad: 2, activo: true, fotos: [], totalResenas: 0,
    ...overrides,
  };
}

describe("AlojamientoBajaButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra 'Dar de baja' para un alojamiento activo", () => {
    render(<AlojamientoBajaButton alojamiento={alojamiento({ activo: true })} />);
    expect(screen.getByRole("button", { name: "Dar de baja" })).toBeInTheDocument();
  });

  it("muestra 'Reactivar' para un alojamiento inactivo", () => {
    render(<AlojamientoBajaButton alojamiento={alojamiento({ activo: false })} />);
    expect(screen.getByRole("button", { name: "Reactivar" })).toBeInTheDocument();
  });

  it("clickear un activo llama a darDeBajaAlojamientoAction, no a activar", async () => {
    render(<AlojamientoBajaButton alojamiento={alojamiento({ activo: true, id: "a-9" })} />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(darDeBajaAlojamientoAction).toHaveBeenCalledWith("a-9"));
    expect(activarAlojamientoAction).not.toHaveBeenCalled();
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("clickear uno inactivo llama a activarAlojamientoAction, no a dar de baja", async () => {
    render(<AlojamientoBajaButton alojamiento={alojamiento({ activo: false, id: "a-7" })} />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(activarAlojamientoAction).toHaveBeenCalledWith("a-7"));
    expect(darDeBajaAlojamientoAction).not.toHaveBeenCalled();
  });
});
