import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComingSoon } from "./coming-soon";

describe("ComingSoon", () => {
  it("muestra el título, la descripción y un link de vuelta al inicio", () => {
    render(<ComingSoon title="Experiencias" description="Muy pronto" gradient="linear-gradient(...)" />);
    expect(screen.getByRole("heading", { name: "Experiencias" })).toBeInTheDocument();
    expect(screen.getByText("Muy pronto")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver al inicio" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("img", { name: "Experiencias" })).toBeInTheDocument();
  });
});
