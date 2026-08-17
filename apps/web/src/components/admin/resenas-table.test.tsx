import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Resena } from "@turismo-marcuzzi/shared-types";
import { ResenasTable } from "./resenas-table";

const { moderarResenaAction, refresh } = vi.hoisted(() => ({
  moderarResenaAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/app/actions/admin", () => ({ moderarResenaAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

function resena(overrides: Partial<Resena> = {}): Resena {
  return {
    id: "res-1",
    usuarioId: "u-1",
    usuarioNombre: "María Gómez",
    rating: 4,
    texto: "Muy buena estadía, todo impecable.",
    createdAt: "2026-08-01T00:00:00Z",
    oculta: false,
    alojamiento: { id: "a-1", nombre: "Depto Península" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ResenasTable — filtros y búsqueda", () => {
  it("sin reseñas, muestra el mensaje de vacío general", () => {
    render(<ResenasTable resenas={[]} />);
    expect(screen.getByText("Todavía no hay reseñas.")).toBeInTheDocument();
  });

  it("por defecto solo muestra las visibles", () => {
    render(
      <ResenasTable
        resenas={[resena({ id: "1", oculta: false }), resena({ id: "2", oculta: true })]}
      />,
    );
    expect(screen.getAllByRole("row")).toHaveLength(2); // header + 1 visible
  });

  it("la pestaña Ocultas filtra por reseñas ocultas", () => {
    render(
      <ResenasTable
        resenas={[
          resena({ id: "1", usuarioNombre: "Visible User", oculta: false }),
          resena({ id: "2", usuarioNombre: "Hidden User", oculta: true }),
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ocultas" }));
    expect(screen.getByText("Hidden User")).toBeInTheDocument();
    expect(screen.queryByText("Visible User")).not.toBeInTheDocument();
  });

  it("sin resultados en un filtro, el mensaje menciona el filtro elegido", () => {
    render(<ResenasTable resenas={[resena({ oculta: false })]} />);
    fireEvent.click(screen.getByRole("button", { name: "Ocultas" }));
    expect(screen.getByText("No hay reseñas ocultas en este momento.")).toBeInTheDocument();
  });

  it("busca por usuario, alojamiento o texto sin tener en cuenta tildes", () => {
    render(<ResenasTable resenas={[resena()]} />);
    fireEvent.change(screen.getByLabelText("Buscar reseñas"), { target: { value: "gomez" } });
    expect(screen.getByText("María Gómez")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Buscar reseñas"), { target: { value: "peninsula" } });
    expect(screen.getByText("María Gómez")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Buscar reseñas"), { target: { value: "impecable" } });
    expect(screen.getByText("María Gómez")).toBeInTheDocument();
  });

  it("una búsqueda sin coincidencias muestra el mensaje de 'ninguna coincide'", () => {
    render(<ResenasTable resenas={[resena()]} />);
    fireEvent.change(screen.getByLabelText("Buscar reseñas"), { target: { value: "zzzzz" } });
    expect(screen.getByText("Ninguna reseña coincide con la búsqueda.")).toBeInTheDocument();
  });
});

describe("ResenasTable — fila expandible", () => {
  it("clickear una fila la expande y muestra el texto completo y acciones", () => {
    render(<ResenasTable resenas={[resena()]} />);
    fireEvent.click(screen.getByText("María Gómez"));
    expect(screen.getAllByText("Muy buena estadía, todo impecable.").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Ocultar" })).toBeInTheDocument();
  });

  it("con alojamiento asociado, muestra un link a 'Ver alojamiento'", () => {
    render(<ResenasTable resenas={[resena()]} />);
    fireEvent.click(screen.getByText("María Gómez"));
    expect(screen.getByRole("link", { name: "Ver alojamiento →" })).toHaveAttribute(
      "href",
      "/alojamiento/a-1",
    );
  });

  it("sin alojamiento asociado, no muestra el link y la columna dice guion", () => {
    render(<ResenasTable resenas={[resena({ alojamiento: undefined })]} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    fireEvent.click(screen.getByText("María Gómez"));
    expect(screen.queryByRole("link", { name: "Ver alojamiento →" })).not.toBeInTheDocument();
  });

  it("una reseña oculta muestra el botón Mostrar en vez de Ocultar", () => {
    render(<ResenasTable resenas={[resena({ oculta: true })]} />);
    fireEvent.click(screen.getByRole("button", { name: "Ocultas" }));
    fireEvent.click(screen.getByText("María Gómez"));
    expect(screen.getByRole("button", { name: "Mostrar" })).toBeInTheDocument();
  });
});
