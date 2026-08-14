import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScrollReveal } from "./scroll-reveal";

describe("ScrollReveal", () => {
  it("renderiza sus hijos", () => {
    render(
      <ScrollReveal>
        <p>Contenido revelado</p>
      </ScrollReveal>,
    );
    expect(screen.getByText("Contenido revelado")).toBeInTheDocument();
  });

  it("aplica la className pasada al wrapper", () => {
    const { container } = render(
      <ScrollReveal className="mi-clase">
        <span>x</span>
      </ScrollReveal>,
    );
    expect(container.firstChild).toHaveClass("mi-clase");
  });
});
