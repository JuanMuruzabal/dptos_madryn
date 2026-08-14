import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EstadoDot } from "./estado-dot";

describe("EstadoDot", () => {
  it("pendiente: etiqueta y color marrón", () => {
    render(<EstadoDot estado="pendiente" />);
    const dot = screen.getByRole("img", { name: "Pendiente" });
    expect(dot).toHaveAttribute("title", "Pendiente");
    expect(dot.className).toContain("bg-[#8a6a2e]");
  });

  it("confirmada: etiqueta y color verde", () => {
    render(<EstadoDot estado="confirmada" />);
    const dot = screen.getByRole("img", { name: "Confirmada" });
    expect(dot.className).toContain("bg-steppe");
  });

  it("cancelada: etiqueta y color rojo", () => {
    render(<EstadoDot estado="cancelada" />);
    const dot = screen.getByRole("img", { name: "Cancelada" });
    expect(dot.className).toContain("bg-coral-dark");
  });
});
