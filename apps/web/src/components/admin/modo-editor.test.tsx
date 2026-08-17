import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Alojamiento } from "@turismo-marcuzzi/shared-types";
import { ModoEditor } from "./modo-editor";

const { push, actualizarAlojamientoAction, activarAlojamientoAction } = vi.hoisted(() => ({
  push: vi.fn(),
  actualizarAlojamientoAction: vi.fn(),
  activarAlojamientoAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/app/actions/admin", () => ({ actualizarAlojamientoAction, activarAlojamientoAction }));
vi.mock("@/components/admin/fotos-manager", () => ({
  FotosManager: () => <div data-testid="fotos-manager" />,
}));

// AlojamientoForm real arrastra LocationPicker (Leaflet) — se mockea acá
// con un <form> de verdad (mismo id que le pasa ModoEditor) para que el
// botón "Guardar y salir" del modal, que le pega vía el atributo HTML
// form="...", lo pueda enviar de verdad. Dos botones simulan lo que el
// form real dispararía: "simular cambio" llama a onDirtyChange(true) como
// si el usuario hubiera tocado un campo; el submit llama a onSubmitResult
// como si el guardado hubiera terminado.
const { onSubmitResultMock } = vi.hoisted(() => ({ onSubmitResultMock: { current: true } }));
vi.mock("@/components/admin/alojamiento-form", () => ({
  AlojamientoForm: ({
    formId,
    onDirtyChange,
    onSubmitResult,
  }: {
    formId?: string;
    onDirtyChange?: (d: boolean) => void;
    onSubmitResult?: (success: boolean) => void;
  }) => (
    <form
      id={formId}
      data-testid="alojamiento-form"
      onSubmit={(e) => {
        e.preventDefault();
        // Mismo comportamiento que el AlojamientoForm real (ver
        // alojamiento-form.tsx): en éxito también resetea dirty, no solo
        // avisa el resultado.
        if (onSubmitResultMock.current) onDirtyChange?.(false);
        onSubmitResult?.(onSubmitResultMock.current);
      }}
    >
      <button type="button" onClick={() => onDirtyChange?.(true)}>
        simular cambio
      </button>
      <button type="submit">submit-mock</button>
    </form>
  ),
}));

function alojamiento(overrides: Partial<Alojamiento> = {}): Alojamiento {
  return {
    id: "a-1",
    nombre: "Depto Test",
    descripcion: "",
    lat: -42.7,
    lng: -65.0,
    direccion: "",
    precioNoche: 15000,
    capacidad: 4,
    activo: true,
    fotos: [],
    totalResenas: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  onSubmitResultMock.current = true;
});

describe("ModoEditor", () => {
  it("un alojamiento no publicado muestra el aviso con el botón Publicar", () => {
    render(<ModoEditor id="a-1" alojamiento={alojamiento({ activo: false })} />);
    expect(screen.getByText("Todavía no publicado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicar" })).toBeInTheDocument();
  });

  it("un alojamiento publicado no muestra el aviso", () => {
    render(<ModoEditor id="a-1" alojamiento={alojamiento({ activo: true })} />);
    expect(screen.queryByText("Todavía no publicado")).not.toBeInTheDocument();
  });

  it("sin cambios pendientes, 'Ver página'/'Volver al panel' navegan directo, sin aviso", () => {
    render(<ModoEditor id="a-1" alojamiento={alojamiento()} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver página" }));
    expect(push).toHaveBeenCalledWith("/alojamiento/a-1");
    expect(screen.queryByText("Tenés cambios sin guardar")).not.toBeInTheDocument();
  });

  it("con cambios pendientes, salir muestra el aviso en vez de navegar directo", () => {
    render(<ModoEditor id="a-1" alojamiento={alojamiento()} />);
    fireEvent.click(screen.getByRole("button", { name: "simular cambio" }));

    fireEvent.click(screen.getByRole("button", { name: "Volver al panel" }));

    expect(screen.getByText("Tenés cambios sin guardar")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("'Seguir editando' cierra el aviso sin navegar", () => {
    render(<ModoEditor id="a-1" alojamiento={alojamiento()} />);
    fireEvent.click(screen.getByRole("button", { name: "simular cambio" }));
    fireEvent.click(screen.getByRole("button", { name: "Volver al panel" }));

    fireEvent.click(screen.getByRole("button", { name: "Seguir editando" }));

    expect(screen.queryByText("Tenés cambios sin guardar")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("'Salir sin guardar' navega al destino pendiente sin guardar nada", () => {
    render(<ModoEditor id="a-1" alojamiento={alojamiento()} />);
    fireEvent.click(screen.getByRole("button", { name: "simular cambio" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver página" }));

    fireEvent.click(screen.getByRole("button", { name: "Salir sin guardar" }));

    expect(push).toHaveBeenCalledWith("/alojamiento/a-1");
  });

  it("'Guardar y salir' envía el form real y, al confirmarse, navega al destino pendiente", async () => {
    render(<ModoEditor id="a-1" alojamiento={alojamiento()} />);
    fireEvent.click(screen.getByRole("button", { name: "simular cambio" }));
    fireEvent.click(screen.getByRole("button", { name: "Volver al panel" }));

    fireEvent.click(screen.getByRole("button", { name: "Guardar y salir" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/alojamientos"));
  });

  it("si el guardado desde el aviso falla, no navega y cierra el aviso", async () => {
    onSubmitResultMock.current = false;
    render(<ModoEditor id="a-1" alojamiento={alojamiento()} />);
    fireEvent.click(screen.getByRole("button", { name: "simular cambio" }));
    fireEvent.click(screen.getByRole("button", { name: "Volver al panel" }));

    fireEvent.click(screen.getByRole("button", { name: "Guardar y salir" }));

    await waitFor(() => expect(screen.queryByText("Tenés cambios sin guardar")).not.toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();
  });

  it("guardar directo (sin pasar por el aviso) también resetea dirty — salir después ya no avisa", async () => {
    render(<ModoEditor id="a-1" alojamiento={alojamiento()} />);
    fireEvent.click(screen.getByRole("button", { name: "simular cambio" }));

    fireEvent.click(screen.getByRole("button", { name: "submit-mock" }));
    await waitFor(() => expect(screen.getByTestId("alojamiento-form")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Ver página" }));
    expect(push).toHaveBeenCalledWith("/alojamiento/a-1");
    expect(screen.queryByText("Tenés cambios sin guardar")).not.toBeInTheDocument();
  });

  it("con cambios pendientes, beforeunload se cancela (preventDefault) para mostrar el aviso nativo", () => {
    render(<ModoEditor id="a-1" alojamiento={alojamiento()} />);
    fireEvent.click(screen.getByRole("button", { name: "simular cambio" }));

    const evento = new Event("beforeunload", { cancelable: true });
    const preventDefault = vi.spyOn(evento, "preventDefault");
    window.dispatchEvent(evento);

    expect(preventDefault).toHaveBeenCalled();
  });

  it("sin cambios pendientes, beforeunload no se cancela", () => {
    render(<ModoEditor id="a-1" alojamiento={alojamiento()} />);

    const evento = new Event("beforeunload", { cancelable: true });
    const preventDefault = vi.spyOn(evento, "preventDefault");
    window.dispatchEvent(evento);

    expect(preventDefault).not.toHaveBeenCalled();
  });
});
