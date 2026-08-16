import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReservaEstadoBadge } from "./reserva-estado-badge";

describe("ReservaEstadoBadge", () => {
  it("pendiente", () => {
    render(<ReservaEstadoBadge estado="pendiente" />);
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
  });

  it("confirmada", () => {
    render(<ReservaEstadoBadge estado="confirmada" />);
    expect(screen.getByText("Confirmada")).toBeInTheDocument();
  });

  it("cancelada", () => {
    render(<ReservaEstadoBadge estado="cancelada" />);
    expect(screen.getByText("Cancelada")).toBeInTheDocument();
  });
});
