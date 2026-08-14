import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeaturedCategoriesWithOverrides } from "./featured-categories-with-overrides";

const { fetchImagenesSitioMap } = vi.hoisted(() => ({ fetchImagenesSitioMap: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchImagenesSitioMap }));

vi.mock("./featured-categories", () => ({
  FeaturedCategories: ({ categories }: { categories: { title: string; scene: { image?: string } }[] }) => (
    <div data-testid="categories">
      {categories.map((c) => `${c.title}:${c.scene.image ?? "sin-foto"}`).join(",")}
    </div>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FeaturedCategoriesWithOverrides", () => {
  it("sin overrides cargados, pasa las categorías sin foto", async () => {
    fetchImagenesSitioMap.mockResolvedValue(new Map());
    render((await FeaturedCategoriesWithOverrides()) as React.ReactElement);
    expect(screen.getByTestId("categories").textContent).toContain("sin-foto");
  });

  it("con un override cargado, lo mezcla en la categoría correspondiente", async () => {
    fetchImagenesSitioMap.mockResolvedValue(new Map([["home_categoria_alojamiento", "/foto-real.jpg"]]));
    render((await FeaturedCategoriesWithOverrides()) as React.ReactElement);
    expect(screen.getByTestId("categories").textContent).toContain("Alojamiento:/foto-real.jpg");
  });
});
