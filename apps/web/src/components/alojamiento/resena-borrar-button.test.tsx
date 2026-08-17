import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ResenaBorrarButton } from "./resena-borrar-button";

const { borrarResenaAction, refresh } = vi.hoisted(() => ({
  borrarResenaAction: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/app/actions/resenas", () => ({ borrarResenaAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

describe("ResenaBorrarButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("arranca mostrando solo 'Eliminar', sin llamar a la acción", () => {
    render(<ResenaBorrarButton id="r-1" alojamientoId="a-1" />);
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeInTheDocument();
    expect(borrarResenaAction).not.toHaveBeenCalled();
  });

  it("clickear 'Eliminar' pide confirmación en vez de borrar directo", () => {
    render(<ResenaBorrarButton id="r-1" alojamientoId="a-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(screen.getByText("¿Borrar tu reseña?")).toBeInTheDocument();
    expect(borrarResenaAction).not.toHaveBeenCalled();
  });

  it("confirmar llama a borrarResenaAction con el id y refresca", async () => {
    render(<ResenaBorrarButton id="r-9" alojamientoId="a-42" />);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, borrar" }));

    await waitFor(() => expect(borrarResenaAction).toHaveBeenCalledWith("r-9", "a-42"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("cancelar vuelve al botón inicial sin borrar", () => {
    render(<ResenaBorrarButton id="r-1" alojamientoId="a-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.getByRole("button", { name: "Eliminar" })).toBeInTheDocument();
    expect(borrarResenaAction).not.toHaveBeenCalled();
  });
});
