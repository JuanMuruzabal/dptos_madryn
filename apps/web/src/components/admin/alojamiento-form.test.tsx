import { createRef } from "react";
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

  it("expone el <form> real vía ref (React 19, sin forwardRef) — para requestSubmit() externo", () => {
    const ref = createRef<HTMLFormElement>();
    render(<AlojamientoForm alojamiento={alojamiento()} action={action} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLFormElement);
  });

  describe("aviso de cambios sin guardar (2026-08-17, pedido del cliente)", () => {
    it("tocar un campo llama a onDirtyChange(true)", async () => {
      const onDirtyChange = vi.fn();
      const user = userEvent.setup();
      render(<AlojamientoForm alojamiento={alojamiento()} action={action} onDirtyChange={onDirtyChange} />);

      await user.type(screen.getByLabelText("Nombre"), "x");

      expect(onDirtyChange).toHaveBeenCalledWith(true);
    });

    it("guardar con éxito llama a onDirtyChange(false) y a onSubmitResult(true)", async () => {
      action.mockResolvedValue({ success: true });
      const onDirtyChange = vi.fn();
      const onSubmitResult = vi.fn();
      const user = userEvent.setup();
      render(
        <AlojamientoForm
          alojamiento={alojamiento()}
          action={action}
          onDirtyChange={onDirtyChange}
          onSubmitResult={onSubmitResult}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

      await screen.findByText("Guardado.");
      expect(onDirtyChange).toHaveBeenLastCalledWith(false);
      expect(onSubmitResult).toHaveBeenCalledWith(true);
    });

    it("guardar con error llama a onSubmitResult(false), sin resetear dirty", async () => {
      action.mockResolvedValue({ error: "falló" });
      const onDirtyChange = vi.fn();
      const onSubmitResult = vi.fn();
      const user = userEvent.setup();
      render(
        <AlojamientoForm
          alojamiento={alojamiento()}
          action={action}
          onDirtyChange={onDirtyChange}
          onSubmitResult={onSubmitResult}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

      await screen.findByRole("alert");
      expect(onSubmitResult).toHaveBeenCalledWith(false);
      expect(onDirtyChange).not.toHaveBeenCalledWith(false);
    });

    it("sin tocar nada, no llama a onDirtyChange", () => {
      const onDirtyChange = vi.fn();
      render(<AlojamientoForm alojamiento={alojamiento()} action={action} onDirtyChange={onDirtyChange} />);
      expect(onDirtyChange).not.toHaveBeenCalled();
    });
  });
});
