import { act } from "react";
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
// con un <form> de verdad, con `ref` (React 19, sin forwardRef) igual que
// el real, para que formRef.current?.requestSubmit() de ModoEditor
// funcione de verdad en el test. Dos botones simulan lo que el form real
// dispararía: "simular cambio" llama a onDirtyChange(true) como si el
// usuario hubiera tocado un campo; el submit llama a onSubmitResult (y
// onDirtyChange(false) en éxito, mismo comportamiento que el real) como
// si el guardado hubiera terminado.
const { onSubmitResultMock } = vi.hoisted(() => ({ onSubmitResultMock: { current: true } }));
vi.mock("@/components/admin/alojamiento-form", () => ({
  AlojamientoForm: ({
    ref,
    onDirtyChange,
    onSubmitResult,
  }: {
    ref?: React.Ref<HTMLFormElement>;
    onDirtyChange?: (d: boolean) => void;
    onSubmitResult?: (success: boolean) => void;
  }) => (
    <form
      ref={ref}
      data-testid="alojamiento-form"
      onSubmit={(e) => {
        e.preventDefault();
        // queueMicrotask (no síncrono): simula que el guardado real tarda
        // un instante, igual que el useActionState real — necesario para
        // poder observar el estado intermedio "guardando" en un test (si
        // resolviera en la misma vuelta del event handler, React
        // batchearía el true→false junto y nunca se vería el intermedio).
        queueMicrotask(() => {
          if (onSubmitResultMock.current) onDirtyChange?.(false);
          onSubmitResult?.(onSubmitResultMock.current);
        });
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
    fireEvent.click(screen.getByRole("link", { name: "Ver página" }));
    expect(screen.queryByText(/cambios sin guardar/i)).not.toBeInTheDocument();
  });

  it("con cambios pendientes, 'Ver página'/'Volver al panel' muestran el aviso en vez de navegar", () => {
    render(<ModoEditor id="a-1" alojamiento={alojamiento()} />);
    fireEvent.click(screen.getByRole("button", { name: "simular cambio" }));

    fireEvent.click(screen.getByRole("link", { name: "Volver al panel" }));

    expect(screen.getByText(/cambios sin guardar/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("con cambios pendientes, CUALQUIER link interno de la página muestra el aviso (no solo los 2 botones)", () => {
    render(
      <div>
        <a href="/otra-pagina">Otra sección del sitio</a>
        <ModoEditor id="a-1" alojamiento={alojamiento()} />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "simular cambio" }));

    fireEvent.click(screen.getByRole("link", { name: "Otra sección del sitio" }));

    expect(screen.getByText(/cambios sin guardar/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("un link externo no se intercepta, aunque haya cambios pendientes", () => {
    render(
      <div>
        <a href="https://ejemplo-externo.com">Externo</a>
        <ModoEditor id="a-1" alojamiento={alojamiento()} />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "simular cambio" }));

    fireEvent.click(screen.getByRole("link", { name: "Externo" }));

    expect(screen.queryByText(/cambios sin guardar/i)).not.toBeInTheDocument();
  });

  it("'Seguir editando' cierra el aviso sin navegar", () => {
    render(<ModoEditor id="a-1" alojamiento={alojamiento()} />);
    fireEvent.click(screen.getByRole("button", { name: "simular cambio" }));
    fireEvent.click(screen.getByRole("link", { name: "Volver al panel" }));

    fireEvent.click(screen.getByRole("button", { name: "Seguir editando" }));

    expect(screen.queryByText(/cambios sin guardar/i)).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("'Salir sin guardar' navega al destino pendiente sin guardar nada", () => {
    render(<ModoEditor id="a-1" alojamiento={alojamiento()} />);
    fireEvent.click(screen.getByRole("button", { name: "simular cambio" }));
    fireEvent.click(screen.getByRole("link", { name: "Ver página" }));

    fireEvent.click(screen.getByRole("button", { name: "Salir sin guardar" }));

    expect(push).toHaveBeenCalledWith("/alojamiento/a-1");
  });

  it("'Guardar y salir' envía el form real (requestSubmit) y, al confirmarse, navega al destino pendiente", async () => {
    render(<ModoEditor id="a-1" alojamiento={alojamiento()} />);
    fireEvent.click(screen.getByRole("button", { name: "simular cambio" }));
    fireEvent.click(screen.getByRole("link", { name: "Volver al panel" }));

    fireEvent.click(screen.getByRole("button", { name: "Guardar y salir" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/alojamientos"));
  });

  it("mientras guarda, las demás opciones del aviso quedan deshabilitadas", () => {
    onSubmitResultMock.current = true;
    render(<ModoEditor id="a-1" alojamiento={alojamiento()} />);
    fireEvent.click(screen.getByRole("button", { name: "simular cambio" }));
    fireEvent.click(screen.getByRole("link", { name: "Volver al panel" }));

    // El mock resuelve el submit de forma síncrona (sin await), así que
    // para ver el estado "a mitad de guardar" hace falta separar el
    // requestSubmit() del resto — alcanza con click directo al botón, que
    // ya deja `guardando` en true ANTES de que el submit síncrono del
    // mock corra completo la primera vuelta de eventos.
    fireEvent.click(screen.getByRole("button", { name: /guardar y salir|guardando/i }));

    expect(screen.getByRole("button", { name: "Salir sin guardar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Seguir editando" })).toBeDisabled();
  });

  it("si el guardado desde el aviso falla, no navega, cierra el aviso, y deja dirty sin resetear", async () => {
    onSubmitResultMock.current = false;
    render(<ModoEditor id="a-1" alojamiento={alojamiento()} />);
    fireEvent.click(screen.getByRole("button", { name: "simular cambio" }));
    fireEvent.click(screen.getByRole("link", { name: "Volver al panel" }));

    fireEvent.click(screen.getByRole("button", { name: "Guardar y salir" }));

    await waitFor(() => expect(screen.queryByText(/cambios sin guardar/i)).not.toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();

    // dirty seguía en true (el guardado falló) — salir de nuevo vuelve a avisar.
    fireEvent.click(screen.getByRole("link", { name: "Volver al panel" }));
    expect(screen.getByText(/cambios sin guardar/i)).toBeInTheDocument();
  });

  it("guardar directo (sin pasar por el aviso) también resetea dirty — salir después ya no avisa", async () => {
    render(<ModoEditor id="a-1" alojamiento={alojamiento()} />);
    fireEvent.click(screen.getByRole("button", { name: "simular cambio" }));

    fireEvent.click(screen.getByRole("button", { name: "submit-mock" }));
    // Deja correr el microtask del mock (ver el comentario en el mock de
    // arriba) antes de seguir — ahí es donde onDirtyChange(false) corre.
    // act() (no un await Promise.resolve() suelto): ese setState pasa
    // FUERA de cualquier fireEvent, React se queja si no está envuelto.
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("link", { name: "Ver página" }));
    expect(push).not.toHaveBeenCalled(); // navegación real de <Link>, jsdom no la sigue
    expect(screen.queryByText(/cambios sin guardar/i)).not.toBeInTheDocument();
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
