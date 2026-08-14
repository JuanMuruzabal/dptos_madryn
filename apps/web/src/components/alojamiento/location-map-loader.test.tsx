import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocationMapLoader } from "./location-map-loader";

vi.mock("./location-map", () => ({
  LocationMap: ({ nombre }: { nombre: string }) => <div data-testid="location-map">{nombre}</div>,
}));

describe("LocationMapLoader", () => {
  it("carga y renderiza el LocationMap real de forma diferida", async () => {
    render(<LocationMapLoader lat={-42.7} lng={-65.0} nombre="Depto Test" />);
    expect(await screen.findByTestId("location-map")).toHaveTextContent("Depto Test");
  });
});
