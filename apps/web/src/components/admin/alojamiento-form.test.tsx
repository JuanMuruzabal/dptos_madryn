import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Alojamiento } from "@turismo-marcuzzi/shared-types";
import { AlojamientoForm } from "./alojamiento-form";

vi.mock("@/components/admin/location-picker", () => ({
  LocationPicker: () => <div data-testid="location-picker" />,
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

const action = vi.fn(async () => ({}));

beforeEach(() => {
  vi.clearAllMocks();
  action.mockResolvedValue({});
});

describe("AlojamientoForm", () => {
  it("sin alojamiento, el botón dice 'Crear alojamiento'", () => {
    render(<AlojamientoForm action={action} />);
    expect(screen.getByRole("button", { name: "Crear alojamiento" })).toBeInTheDocument();
  });

  it("con un alojamiento, precarga los valores y el botón dice 'Guardar cambios'", () => {
    render(<AlojamientoForm alojamiento={alojamiento()} action={action} />);
    expect(screen.getByLabelText("Nombre")).toHaveValue("Depto Península");
    expect(screen.getByLabelText("Precio por noche (ARS)")).toHaveValue(15000);
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeInTheDocument();
  });

  it("muestra el error del backend", async () => {
    action.mockResolvedValue({ error: "El precio debe ser mayor a cero." });
    const user = userEvent.setup();
    render(<AlojamientoForm action={action} />);
    await user.type(screen.getByLabelText("Nombre"), "x");
    await user.type(screen.getByLabelText("Precio por noche (ARS)"), "1000");
    await user.type(screen.getByLabelText("Capacidad (huéspedes)"), "2");
    await user.click(screen.getByRole("button", { name: "Crear alojamiento" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El precio debe ser mayor a cero.");
  });

  it("muestra 'Guardado.' al confirmarse sin error", async () => {
    action.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<AlojamientoForm alojamiento={alojamiento()} action={action} />);
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("Guardado.")).toBeInTheDocument();
  });
});
