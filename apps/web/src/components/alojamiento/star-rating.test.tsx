import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StarRating } from "./star-rating";

describe("StarRating", () => {
  it("redondea el rating fraccional para decidir cuántas estrellas llenar", () => {
    render(<StarRating rating={4.6} />);
    expect(screen.getByLabelText("4.6 de 5 estrellas")).toBeInTheDocument();
  });

  it("5 de 5 llena todas las estrellas, ninguna vacía", () => {
    const { container } = render(<StarRating rating={5} />);
    const [llenas, vacias] = container.querySelectorAll("span[aria-hidden]");
    expect(llenas.textContent).toBe("★★★★★");
    expect(vacias.textContent).toBe("");
  });

  it("0 de 5 no llena ninguna estrella", () => {
    const { container } = render(<StarRating rating={0} />);
    const [llenas, vacias] = container.querySelectorAll("span[aria-hidden]");
    expect(llenas.textContent).toBe("");
    expect(vacias.textContent).toBe("★★★★★");
  });

  it("usa el tamaño 'md' cuando se pide explícitamente", () => {
    render(<StarRating rating={3} size="md" />);
    expect(screen.getByLabelText("3.0 de 5 estrellas").className).toContain("text-xl");
  });
});
