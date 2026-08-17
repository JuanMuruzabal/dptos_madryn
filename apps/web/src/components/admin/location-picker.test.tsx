import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LocationPicker } from "./location-picker";

// Leaflet manipula el DOM real de formas que jsdom no soporta (canvas,
// tiles) — se mockea el módulo entero. El componente ya está diseñado
// para tolerar esto (import dinámico dentro de un efecto, nunca en el
// cuerpo del render), así que alcanza con un mapa/marker de mentira que
// implemente los métodos que el componente realmente llama.
const marker = {
  addTo: vi.fn().mockReturnThis(),
  on: vi.fn(),
  setLatLng: vi.fn(),
  getLatLng: vi.fn(() => ({ lat: -42.7667, lng: -65.0333 })),
};
const map = {
  on: vi.fn(),
  remove: vi.fn(),
  setView: vi.fn(),
};
const leafletDefault = {
  map: vi.fn(() => map),
  tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
  divIcon: vi.fn(() => ({})),
  marker: vi.fn(() => marker),
};
vi.mock("leaflet", () => ({ default: leafletDefault }));

function mockGeocodeOnce(resultados: Array<{ lat: string; lon: string }>) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ json: vi.fn().mockResolvedValue(resultados) } as unknown as Response),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LocationPicker", () => {
  it("usa el centro de Puerto Madryn por defecto sin coordenadas iniciales", async () => {
    render(<LocationPicker />);
    await waitFor(() => expect(leafletDefault.map).toHaveBeenCalled());
    expect(screen.getByText(/Coordenadas: -42\.76670, -65\.03330/)).toBeInTheDocument();
  });

  it("usa las coordenadas iniciales cuando se pasan (modo edición)", async () => {
    render(<LocationPicker latInicial={-40} lngInicial={-60} direccionInicial="Calle X" />);
    await waitFor(() => expect(leafletDefault.map).toHaveBeenCalled());
    expect(screen.getByText(/Coordenadas: -40\.00000, -60\.00000/)).toBeInTheDocument();
    expect(screen.getByLabelText("Dirección")).toHaveValue("Calle X");
  });

  it("el input de dirección es editable", async () => {
    render(<LocationPicker />);
    await waitFor(() => expect(leafletDefault.map).toHaveBeenCalled());
    const input = screen.getByLabelText("Dirección");
    fireEvent.change(input, { target: { value: "Blvd. Brown 1234" } });
    expect(input).toHaveValue("Blvd. Brown 1234");
  });

  it("buscar sin escribir nada muestra un error y no llama a fetch", async () => {
    render(<LocationPicker />);
    await waitFor(() => expect(leafletDefault.map).toHaveBeenCalled());
    vi.stubGlobal("fetch", vi.fn());

    fireEvent.click(screen.getByRole("button", { name: /buscar en el mapa/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Escribí una dirección primero.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("geocodifica y mueve el pin al encontrar la dirección", async () => {
    mockGeocodeOnce([{ lat: "-42.80", lon: "-65.10" }]);
    render(<LocationPicker />);
    await waitFor(() => expect(leafletDefault.map).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Dirección"), { target: { value: "Blvd. Brown 1234" } });
    fireEvent.click(screen.getByRole("button", { name: /buscar en el mapa/i }));

    await waitFor(() => expect(screen.getByText(/Coordenadas: -42\.80000, -65\.10000/)).toBeInTheDocument());
    expect(marker.setLatLng).toHaveBeenCalledWith([-42.8, -65.1]);
    expect(map.setView).toHaveBeenCalledWith([-42.8, -65.1], 16);

    // El query completa ciudad/provincia/país — el admin no tiene que
    // escribirlos.
    const urlPedida = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(decodeURIComponent(urlPedida)).toContain("Blvd. Brown 1234, Puerto Madryn, Chubut, Argentina");
  });

  it("sin resultados muestra el error de 'no encontramos' y no mueve el pin", async () => {
    mockGeocodeOnce([]);
    render(<LocationPicker />);
    await waitFor(() => expect(leafletDefault.map).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Dirección"), { target: { value: "Dirección inexistente" } });
    fireEvent.click(screen.getByRole("button", { name: /buscar en el mapa/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/no encontramos esa dirección/i);
    expect(marker.setLatLng).not.toHaveBeenCalled();
  });

  it("un error de red muestra un mensaje y no revienta", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    render(<LocationPicker />);
    await waitFor(() => expect(leafletDefault.map).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Dirección"), { target: { value: "Cualquier calle" } });
    fireEvent.click(screen.getByRole("button", { name: /buscar en el mapa/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/no se pudo buscar la dirección/i);
  });

  it("arrastrar el pin actualiza las coordenadas mostradas", async () => {
    render(<LocationPicker />);
    await waitFor(() => expect(leafletDefault.map).toHaveBeenCalled());

    // Simula el callback que Leaflet dispara en un dragend real.
    const dragendCb = marker.on.mock.calls.find(([evento]) => evento === "dragend")?.[1] as () => void;
    expect(dragendCb).toBeDefined();
    dragendCb();

    await waitFor(() => expect(screen.getByText(/Coordenadas: -42\.76670, -65\.03330/)).toBeInTheDocument());
  });

  it("clickear el mapa reubica el pin", async () => {
    render(<LocationPicker />);
    await waitFor(() => expect(leafletDefault.map).toHaveBeenCalled());

    const clickCb = map.on.mock.calls.find(([evento]) => evento === "click")?.[1] as (e: unknown) => void;
    expect(clickCb).toBeDefined();
    clickCb({ latlng: { lat: -41.5, lng: -64.5 } });

    expect(marker.setLatLng).toHaveBeenCalledWith({ lat: -41.5, lng: -64.5 });
    await waitFor(() => expect(screen.getByText(/Coordenadas: -41\.50000, -64\.50000/)).toBeInTheDocument());
  });

  it("los inputs ocultos lat/lng reflejan las coordenadas actuales", async () => {
    const { container } = render(<LocationPicker />);
    await waitFor(() => expect(leafletDefault.map).toHaveBeenCalled());

    const latInput = container.querySelector('input[name="lat"]') as HTMLInputElement;
    const lngInput = container.querySelector('input[name="lng"]') as HTMLInputElement;
    expect(latInput.value).toBe("-42.7667");
    expect(lngInput.value).toBe("-65.0333");
  });

  it("limpia el mapa al desmontar", async () => {
    const { unmount } = render(<LocationPicker />);
    await waitFor(() => expect(leafletDefault.map).toHaveBeenCalled());
    unmount();
    expect(map.remove).toHaveBeenCalled();
  });

  describe("onChange (2026-08-17, aviso de cambios sin guardar)", () => {
    it("arrastrar el pin llama a onChange", async () => {
      const onChange = vi.fn();
      render(<LocationPicker onChange={onChange} />);
      await waitFor(() => expect(leafletDefault.map).toHaveBeenCalled());

      const dragendCb = marker.on.mock.calls.find(([evento]) => evento === "dragend")?.[1] as () => void;
      dragendCb();

      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("clickear el mapa llama a onChange", async () => {
      const onChange = vi.fn();
      render(<LocationPicker onChange={onChange} />);
      await waitFor(() => expect(leafletDefault.map).toHaveBeenCalled());

      const clickCb = map.on.mock.calls.find(([evento]) => evento === "click")?.[1] as (e: unknown) => void;
      clickCb({ latlng: { lat: -41.5, lng: -64.5 } });

      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("geocodificar una dirección encontrada llama a onChange", async () => {
      mockGeocodeOnce([{ lat: "-42.80", lon: "-65.10" }]);
      const onChange = vi.fn();
      render(<LocationPicker onChange={onChange} />);
      await waitFor(() => expect(leafletDefault.map).toHaveBeenCalled());

      fireEvent.change(screen.getByLabelText("Dirección"), { target: { value: "Blvd. Brown 1234" } });
      fireEvent.click(screen.getByRole("button", { name: /buscar en el mapa/i }));

      await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    });

    it("sin onChange (prop opcional), arrastrar el pin no revienta", async () => {
      render(<LocationPicker />);
      await waitFor(() => expect(leafletDefault.map).toHaveBeenCalled());
      const dragendCb = marker.on.mock.calls.find(([evento]) => evento === "dragend")?.[1] as () => void;
      expect(() => dragendCb()).not.toThrow();
    });
  });
});
