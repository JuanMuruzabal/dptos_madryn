import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FotoPortadaCardEditor } from "./foto-portada-card-editor";

vi.mock("@/components/admin/foto-portada-manager", () => ({
  FotoPortadaManager: () => <div data-testid="foto-portada-manager" />,
}));

describe("FotoPortadaCardEditor", () => {
  it("arranca cerrado, sin mostrar el manager", () => {
    render(<FotoPortadaCardEditor alojamientoId="a-1" />);
    expect(screen.getByRole("button", { name: "Editar portada" })).toBeInTheDocument();
    expect(screen.queryByTestId("foto-portada-manager")).not.toBeInTheDocument();
  });

  it("clickear el botón lo abre y muestra el manager; clickear de nuevo lo cierra", () => {
    render(<FotoPortadaCardEditor alojamientoId="a-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Editar portada" }));
    expect(screen.getByTestId("foto-portada-manager")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByTestId("foto-portada-manager")).not.toBeInTheDocument();
  });
});
