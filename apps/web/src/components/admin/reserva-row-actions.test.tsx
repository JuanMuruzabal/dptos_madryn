import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReservaRowActions } from "./reserva-row-actions";

const { actualizarEstadoReservaAction, refresh } = vi.hoisted(() => ({
  actualizarEstadoReservaAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/app/actions/admin", () => ({ actualizarEstadoReservaAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ReservaRowActions", () => {
  it("una reserva cancelada no muestra ninguna acción", () => {
    const { container } = render(<ReservaRowActions id="r-1" estado="cancelada" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("una pendiente muestra Confirmar y Cancelar", () => {
    render(<ReservaRowActions id="r-1" estado="pendiente" />);
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });

  it("una confirmada solo muestra Cancelar (no se puede volver a confirmar)", () => {
    render(<ReservaRowActions id="r-1" estado="confirmada" />);
    expect(screen.queryByRole("button", { name: "Confirmar" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });

  it("Confirmar llama a la acción con 'confirmada'", async () => {
    render(<ReservaRowActions id="r-9" estado="pendiente" />);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(actualizarEstadoReservaAction).toHaveBeenCalledWith("r-9", "confirmada"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("Cancelar llama a la acción con 'cancelada'", async () => {
    render(<ReservaRowActions id="r-9" estado="confirmada" />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(actualizarEstadoReservaAction).toHaveBeenCalledWith("r-9", "cancelada"));
  });
});
