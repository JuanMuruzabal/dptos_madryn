import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Resena } from "@turismo-marcuzzi/shared-types";
import { ResenasList } from "./resenas-list";

// ResenaBorrarButton es "use client" y llama a un Server Action real
// (borrarResenaAction) — acá solo interesa SI se monta o no según el
// dueño, no su comportamiento interno (ya cubierto en su propio test).
vi.mock("@/components/alojamiento/resena-borrar-button", () => ({
  ResenaBorrarButton: ({ id }: { id: string }) => (
    <button type="button">Eliminar {id}</button>
  ),
}));

function resena(overrides: Partial<Resena> = {}): Resena {
  return {
    id: "1",
    usuarioId: "u-1",
    usuarioNombre: "Ana Gómez",
    rating: 4,
    texto: "Muy buena estadía",
    createdAt: "2026-08-01T00:00:00Z",
    oculta: false,
    ...overrides,
  };
}

describe("ResenasList", () => {
  it("sin reseñas, muestra el mensaje de vacío", () => {
    render(<ResenasList resenas={[]} alojamientoId="a-1" />);
    expect(screen.getByText("Todavía no hay reseñas para este alojamiento.")).toBeInTheDocument();
  });

  it("con reseñas, muestra usuario, rating, texto y fecha formateada", () => {
    render(<ResenasList resenas={[resena()]} alojamientoId="a-1" />);
    expect(screen.getByText("Ana Gómez")).toBeInTheDocument();
    expect(screen.getByText("Muy buena estadía")).toBeInTheDocument();
    expect(screen.getByLabelText("4.0 de 5 estrellas")).toBeInTheDocument();
  });

  it("renderiza una entrada por cada reseña", () => {
    const resenas: Resena[] = [
      resena({ id: "1", usuarioNombre: "A", rating: 5, texto: "x" }),
      resena({ id: "2", usuarioNombre: "B", rating: 3, texto: "y" }),
    ];
    const { container } = render(<ResenasList resenas={resenas} alojamientoId="a-1" />);
    expect(container.querySelectorAll("li")).toHaveLength(2);
  });

  it("muestra el botón de borrar solo en la reseña del usuario logueado", () => {
    const resenas: Resena[] = [
      resena({ id: "mia", usuarioId: "u-1" }),
      resena({ id: "ajena", usuarioId: "u-2" }),
    ];
    render(<ResenasList resenas={resenas} alojamientoId="a-1" miUsuarioId="u-1" />);

    expect(screen.getByText("Eliminar mia")).toBeInTheDocument();
    expect(screen.queryByText("Eliminar ajena")).not.toBeInTheDocument();
  });

  it("sin sesión (miUsuarioId undefined), no muestra ningún botón de borrar", () => {
    render(<ResenasList resenas={[resena({ id: "1", usuarioId: "u-1" })]} alojamientoId="a-1" />);
    expect(screen.queryByText("Eliminar 1")).not.toBeInTheDocument();
  });
});
