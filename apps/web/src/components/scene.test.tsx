import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Scene } from "./scene";

describe("Scene", () => {
  it("con scene.image, renderiza un <img>", () => {
    render(<Scene scene={{ place: "Península Valdés", caption: "x", gradient: "g", image: "/foto.jpg" }} alt="Alt" />);
    expect(screen.getByRole("img", { name: "Alt" })).toHaveAttribute("src", expect.stringContaining("foto.jpg"));
  });

  it("sin scene.image, cae al placeholder de gradiente", () => {
    render(<Scene scene={{ place: "x", caption: "x", gradient: "linear-gradient(...)" }} alt="Alt" />);
    const placeholder = screen.getByRole("img", { name: "Alt" });
    expect(placeholder.tagName).toBe("DIV");
    expect(placeholder).toHaveClass("photo-placeholder");
  });
});
