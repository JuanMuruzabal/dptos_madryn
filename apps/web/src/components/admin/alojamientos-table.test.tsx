import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Alojamiento } from "@turismo-marcuzzi/shared-types";
import { AlojamientosTable } from "./alojamientos-table";

const { activarAlojamientoAction, darDeBajaAlojamientoAction, refresh } = vi.hoisted(() => ({
  activarAlojamientoAction: vi.fn(),
  darDeBajaAlojamientoAction: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/app/actions/admin", () => ({ activarAlojamientoAction, darDeBajaAlojamientoAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

function alojamiento(overrides: Partial<Alojamiento> = {}): Alojamiento {
  return {
    id: "a-1",
    nombre: "Depto Península",
    descripcion: "Con vista al mar",
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AlojamientosTable — filtros y búsqueda", () => {
  it("sin alojamientos, muestra el mensaje de vacío general", () => {
    render(<AlojamientosTable alojamientos={[]} />);
    expect(screen.getByText("Todavía no cargaste ningún alojamiento.")).toBeInTheDocument();
  });

  it("por defecto solo muestra los activos", () => {
    render(
      <AlojamientosTable
        alojamientos={[alojamiento({ id: "1", activo: true }), alojamiento({ id: "2", activo: false })]}
      />,
    );
    expect(screen.getAllByRole("row")).toHaveLength(2); // header + 1 activo
  });

  it("la pestaña 'De baja' filtra por inactivos", () => {
    render(
      <AlojamientosTable
        alojamientos={[alojamiento({ id: "1", activo: true }), alojamiento({ id: "2", nombre: "Cabaña Sur", activo: false })]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "De baja" }));
    expect(screen.getByText("Cabaña Sur")).toBeInTheDocument();
    expect(screen.queryByText("Depto Península")).not.toBeInTheDocument();
  });

  it("sin resultados para el filtro activo, muestra el mensaje genérico de estado", () => {
    render(<AlojamientosTable alojamientos={[alojamiento({ activo: false })]} />);
    expect(screen.getByText("No hay alojamientos en este estado.")).toBeInTheDocument();
  });

  it("busca por nombre o dirección sin tener en cuenta tildes", () => {
    render(<AlojamientosTable alojamientos={[alojamiento()]} />);
    fireEvent.change(screen.getByLabelText("Buscar alojamientos"), { target: { value: "peninsula" } });
    expect(screen.getByText("Depto Península")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Buscar alojamientos"), { target: { value: "brown" } });
    expect(screen.getByText("Depto Península")).toBeInTheDocument();
  });

  it("una búsqueda sin coincidencias muestra el mensaje correspondiente", () => {
    render(<AlojamientosTable alojamientos={[alojamiento()]} />);
    fireEvent.change(screen.getByLabelText("Buscar alojamientos"), { target: { value: "zzzzz" } });
    expect(screen.getByText("Ningún alojamiento coincide con la búsqueda.")).toBeInTheDocument();
  });
});

describe("AlojamientosTable — fila expandible", () => {
  it("clickear una fila la expande y muestra dirección y descripción", () => {
    render(<AlojamientosTable alojamientos={[alojamiento()]} />);
    fireEvent.click(screen.getByText("Depto Península"));
    expect(screen.getByText("Blvd. Brown 1234")).toBeInTheDocument();
    expect(screen.getByText("Con vista al mar")).toBeInTheDocument();
  });

  it("sin dirección cargada, muestra el placeholder", () => {
    render(<AlojamientosTable alojamientos={[alojamiento({ direccion: "" })]} />);
    fireEvent.click(screen.getByText("Depto Península"));
    expect(screen.getByText("Sin dirección cargada.")).toBeInTheDocument();
  });

  it("sin descripción, no renderiza el párrafo de descripción", () => {
    render(<AlojamientosTable alojamientos={[alojamiento({ descripcion: "" })]} />);
    fireEvent.click(screen.getByText("Depto Península"));
    expect(screen.queryByText("Con vista al mar")).not.toBeInTheDocument();
  });

  it("los links de Editar y Disponibilidad apuntan al alojamiento correcto", () => {
    render(<AlojamientosTable alojamientos={[alojamiento({ id: "xyz" })]} />);
    fireEvent.click(screen.getByText("Depto Península"));
    expect(screen.getByRole("link", { name: "Editar" })).toHaveAttribute(
      "href",
      "/alojamiento/xyz?modo=editor",
    );
    expect(screen.getByRole("link", { name: "Disponibilidad" })).toHaveAttribute(
      "href",
      "/admin/alojamientos/xyz",
    );
  });

  it("muestra la capacidad en singular cuando es 1 huésped", () => {
    render(<AlojamientosTable alojamientos={[alojamiento({ capacidad: 1 })]} />);
    expect(screen.getByText("1 huésped")).toBeInTheDocument();
  });

  it("muestra el botón Dar de baja para un alojamiento activo", () => {
    render(<AlojamientosTable alojamientos={[alojamiento({ activo: true })]} />);
    fireEvent.click(screen.getByText("Depto Península"));
    expect(screen.getByRole("button", { name: "Dar de baja" })).toBeInTheDocument();
  });
});
