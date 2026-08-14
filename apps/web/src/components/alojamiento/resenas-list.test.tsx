import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Resena } from "@turismo-marcuzzi/shared-types";
import { ResenasList } from "./resenas-list";

describe("ResenasList", () => {
  it("sin reseñas, muestra el mensaje de vacío", () => {
    render(<ResenasList resenas={[]} />);
    expect(screen.getByText("Todavía no hay reseñas para este alojamiento.")).toBeInTheDocument();
  });

  it("con reseñas, muestra usuario, rating, texto y fecha formateada", () => {
    const resenas: Resena[] = [
      { id: "1", usuarioNombre: "Ana Gómez", rating: 4, texto: "Muy buena estadía", createdAt: "2026-08-01T00:00:00Z", oculta: false },
    ];
    render(<ResenasList resenas={resenas} />);
    expect(screen.getByText("Ana Gómez")).toBeInTheDocument();
    expect(screen.getByText("Muy buena estadía")).toBeInTheDocument();
    expect(screen.getByLabelText("4.0 de 5 estrellas")).toBeInTheDocument();
  });

  it("renderiza una entrada por cada reseña", () => {
    const resenas: Resena[] = [
      { id: "1", usuarioNombre: "A", rating: 5, texto: "x", createdAt: "2026-08-01T00:00:00Z", oculta: false },
      { id: "2", usuarioNombre: "B", rating: 3, texto: "y", createdAt: "2026-08-02T00:00:00Z", oculta: false },
    ];
    const { container } = render(<ResenasList resenas={resenas} />);
    expect(container.querySelectorAll("li")).toHaveLength(2);
  });
});
