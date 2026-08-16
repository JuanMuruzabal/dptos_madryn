import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeroWithOverrides } from "./hero-with-overrides";

const { fetchImagenesSitioMap } = vi.hoisted(() => ({ fetchImagenesSitioMap: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchImagenesSitioMap }));

vi.mock("./hero", () => ({
  Hero: ({ scenes }: { scenes: { place: string; image?: string }[] }) => (
    <div data-testid="hero">{scenes.map((s) => `${s.place}:${s.image ?? "sin-foto"}`).join(",")}</div>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("HeroWithOverrides", () => {
  it("sin overrides cargados, pasa las escenas del hero sin foto", async () => {
    fetchImagenesSitioMap.mockResolvedValue(new Map());
    render((await HeroWithOverrides()) as React.ReactElement);
    expect(screen.getByTestId("hero").textContent).toContain("sin-foto");
  });

  it("con un override cargado, lo mezcla en la escena correspondiente", async () => {
    fetchImagenesSitioMap.mockResolvedValue(new Map([["home_hero_golfo_nuevo", "/foto-real.jpg"]]));
    render((await HeroWithOverrides()) as React.ReactElement);
    expect(screen.getByTestId("hero").textContent).toContain("/foto-real.jpg");
  });
});
