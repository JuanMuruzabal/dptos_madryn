import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import PerfilLoading from "./loading";

describe("PerfilLoading", () => {
  it("renderiza el esqueleto de carga", () => {
    const { container } = render(<PerfilLoading />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
