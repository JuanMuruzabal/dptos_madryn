import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AlojamientoFiltersForm } from "./alojamiento-filters-form";

describe("AlojamientoFiltersForm", () => {
  it("sin filtros activos, no muestra el link de 'Limpiar'", () => {
    render(<AlojamientoFiltersForm filtros={{}} />);
    expect(screen.queryByRole("link", { name: "Limpiar" })).not.toBeInTheDocument();
  });

  it("con filtros activos, precarga los valores y muestra 'Limpiar'", () => {
    render(<AlojamientoFiltersForm filtros={{ fechaInicio: "2026-09-01", fechaFin: "2026-09-05", huespedes: 3 }} />);
    expect(screen.getByLabelText("Check-in")).toHaveValue("2026-09-01");
    expect(screen.getByLabelText("Check-out")).toHaveValue("2026-09-05");
    expect(screen.getByLabelText("Huéspedes")).toHaveValue(3);
    expect(screen.getByRole("link", { name: "Limpiar" })).toHaveAttribute("href", "/alojamiento");
  });

  it("el form envía por GET a /alojamiento", () => {
    const { container } = render(<AlojamientoFiltersForm filtros={{}} />);
    const form = container.querySelector("form") as HTMLFormElement;
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/alojamiento");
  });
});
