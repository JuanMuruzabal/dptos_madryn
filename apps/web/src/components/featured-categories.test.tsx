import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeaturedCategories } from "./featured-categories";
import { categories } from "@/lib/categories";

describe("FeaturedCategories", () => {
  it("con el catálogo por defecto, renderiza las 4 categorías como links", () => {
    render(<FeaturedCategories />);
    for (const c of categories) {
      expect(screen.getByRole("link", { name: new RegExp(c.title) })).toHaveAttribute("href", c.href);
    }
  });

  it("acepta un catálogo de categorías propio (overrides)", () => {
    const custom = categories.map((c) => ({ ...c, title: `${c.title} (custom)` }));
    render(<FeaturedCategories categories={custom} />);
    expect(screen.getByText("Alojamiento (custom)")).toBeInTheDocument();
  });
});
