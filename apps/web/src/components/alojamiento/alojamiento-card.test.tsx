import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Alojamiento } from "@turismo-marcuzzi/shared-types";
import { AlojamientoCard } from "./alojamiento-card";

vi.mock("@/components/admin/foto-portada-card-editor", () => ({
  FotoPortadaCardEditor: () => <div data-testid="foto-portada-card-editor" />,
}));

function alojamiento(overrides: Partial<Alojamiento> = {}): Alojamiento {
  return {
    id: "a-1",
    nombre: "Depto Península",
    descripcion: "x",
    lat: -42.7,
    lng: -65.0,
    direccion: "Blvd. Brown 1234",
    precioNoche: 15000,
    capacidad: 4,
    activo: true,
    fotos: [],
    totalResenas: 0,
    ...overrides,
  };
}

describe("AlojamientoCard", () => {
  it("renderiza nombre, precio y capacidad, y linkea al detalle", () => {
    render(<AlojamientoCard alojamiento={alojamiento()} />);
    expect(screen.getByText("Depto Península")).toBeInTheDocument();
    expect(screen.getByText(/15\.000/)).toBeInTheDocument();
    expect(screen.getByText("Hasta 4 huéspedes")).toBeInTheDocument();
    expect(screen.getAllByRole("link")[0]).toHaveAttribute("href", "/alojamiento/a-1");
  });

  it("capacidad 1 usa singular", () => {
    render(<AlojamientoCard alojamiento={alojamiento({ capacidad: 1 })} />);
    expect(screen.getByText("Hasta 1 huésped")).toBeInTheDocument();
  });

  it("sin dirección, no muestra el párrafo de dirección", () => {
    render(<AlojamientoCard alojamiento={alojamiento({ direccion: "" })} />);
    expect(screen.queryByText("Blvd. Brown 1234")).not.toBeInTheDocument();
  });

  it("sin ratingPromedio, no muestra estrellas", () => {
    render(<AlojamientoCard alojamiento={alojamiento({ ratingPromedio: undefined })} />);
    expect(screen.queryByText(/de 5 estrellas/)).not.toBeInTheDocument();
  });

  it("con ratingPromedio, muestra las estrellas y el número", () => {
    render(<AlojamientoCard alojamiento={alojamiento({ ratingPromedio: 4.5 })} />);
    expect(screen.getByLabelText("4.5 de 5 estrellas")).toBeInTheDocument();
    expect(screen.getByText("4.5")).toBeInTheDocument();
  });

  it("sin esAdmin, no muestra el editor de portada", () => {
    render(<AlojamientoCard alojamiento={alojamiento()} />);
    expect(screen.queryByTestId("foto-portada-card-editor")).not.toBeInTheDocument();
  });

  it("con esAdmin, muestra el editor de portada", () => {
    render(<AlojamientoCard alojamiento={alojamiento()} esAdmin />);
    expect(screen.getByTestId("foto-portada-card-editor")).toBeInTheDocument();
  });

  it("usa la foto marcada como portada en vez de la primera si existe", () => {
    const fotos = [
      { id: "f-1", url: "http://x/1.jpg", orden: 0, tipo: "foto" as const, esPortada: false },
      { id: "f-2", url: "http://x/2.jpg", orden: 1, tipo: "foto" as const, esPortada: true },
    ];
    render(<AlojamientoCard alojamiento={alojamiento({ fotos })} />);
    const img = screen.getByRole("img", { name: "Depto Península" });
    expect(img).toHaveAttribute("src", expect.stringContaining(encodeURIComponent("2.jpg")));
  });
});
