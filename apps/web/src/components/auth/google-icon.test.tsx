import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { GoogleIcon } from "./google-icon";

describe("GoogleIcon", () => {
  it("renderiza un svg de 18px por defecto, decorativo (aria-hidden)", () => {
    const { container } = render(<GoogleIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "18");
    expect(svg).toHaveAttribute("height", "18");
    expect(svg).toHaveAttribute("aria-hidden");
  });

  it("acepta un tamaño custom", () => {
    const { container } = render(<GoogleIcon size={24} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "24");
    expect(svg).toHaveAttribute("height", "24");
  });
});
