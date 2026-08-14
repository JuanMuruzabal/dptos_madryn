import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { LocationMap } from "./location-map";

const marker = { addTo: vi.fn().mockReturnThis() };
const map = { remove: vi.fn() };
const leafletDefault = {
  map: vi.fn(() => map),
  tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
  divIcon: vi.fn(() => ({})),
  marker: vi.fn(() => marker),
};
vi.mock("leaflet", () => ({ default: leafletDefault }));
vi.mock("leaflet/dist/leaflet.css", () => ({}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LocationMap", () => {
  it("crea el mapa, el tile layer y el marker con las coordenadas dadas", async () => {
    render(<LocationMap lat={-42.7} lng={-65.0} nombre="Depto Test" />);

    await waitFor(() => expect(leafletDefault.map).toHaveBeenCalled());
    expect(leafletDefault.tileLayer).toHaveBeenCalled();
    expect(leafletDefault.marker).toHaveBeenCalledWith(
      [-42.7, -65.0],
      expect.objectContaining({ alt: "Depto Test" }),
    );
  });

  it("limpia el mapa al desmontar", async () => {
    const { unmount } = render(<LocationMap lat={-42.7} lng={-65.0} nombre="Depto Test" />);
    await waitFor(() => expect(leafletDefault.map).toHaveBeenCalled());
    unmount();
    expect(map.remove).toHaveBeenCalled();
  });
});
