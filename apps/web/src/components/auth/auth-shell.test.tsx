import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthShell } from "./auth-shell";

describe("AuthShell", () => {
  it("renderiza el eyebrow, título, subtítulo, contenido y footer", () => {
    render(
      <AuthShell eyebrow="Bienvenido" title="Ingresá" subtitle="a tu cuenta" footer={<span>¿Sos nuevo?</span>}>
        <p>formulario</p>
      </AuthShell>,
    );
    expect(screen.getByText("Bienvenido")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ingresá" })).toBeInTheDocument();
    expect(screen.getByText("a tu cuenta")).toBeInTheDocument();
    expect(screen.getByText("formulario")).toBeInTheDocument();
    expect(screen.getByText("¿Sos nuevo?")).toBeInTheDocument();
  });
});
