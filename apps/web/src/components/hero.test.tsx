import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { Hero } from "./hero";
import type { Scene } from "@/lib/scenes";

// framer-motion anima con requestAnimationFrame real, que no avanza con
// vi.useFakeTimers() — un <AnimatePresence> real deja tanto la escena
// saliente como la entrante montadas a mitad de la transición, lo que
// vuelve frágil cualquier assert sobre el texto visible. Se mockea con
// passthrough sin animación (mismo criterio que leaflet en
// location-picker.test.tsx: una librería que no puede correr fiel a sí
// misma bajo jsdom).
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: new Proxy(
    {},
    {
      get:
        () =>
        ({ children, ...rest }: { children?: React.ReactNode }) => {
          // Filtra props exclusivas de framer-motion que no son atributos DOM válidos.
          const { initial: _i, animate: _a, exit: _e, transition: _t, whileInView: _w, viewport: _v, ...domProps } =
            rest as Record<string, unknown>;
          void _i;
          void _a;
          void _e;
          void _t;
          void _w;
          void _v;
          return <div {...domProps}>{children}</div>;
        },
    },
  ),
  useReducedMotion: () => false,
}));

const scenes: Scene[] = [
  { place: "Golfo Nuevo", caption: "Atardecer", gradient: "g1" },
  { place: "Península Valdés", caption: "Ballenas", gradient: "g2" },
];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Hero", () => {
  it("renderiza el título, la escena inicial y los links principales", () => {
    render(<Hero scenes={scenes} />);
    expect(screen.getByRole("heading", { name: "Alojamientos Madryn" })).toBeInTheDocument();
    expect(screen.getByText(/Golfo Nuevo — Atardecer/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver alojamientos" })).toHaveAttribute("href", "/alojamiento");
    expect(screen.getByRole("link", { name: "Conocer más" })).toHaveAttribute("href", "#categorias");
  });

  it("rota a la siguiente escena pasado el intervalo", () => {
    render(<Hero scenes={scenes} />);
    expect(screen.getByText(/Golfo Nuevo — Atardecer/)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(6500);
    });
    expect(screen.getByText(/Península Valdés — Ballenas/)).toBeInTheDocument();
  });

  it("vuelve a la primera escena al llegar al final (rotación circular)", () => {
    render(<Hero scenes={scenes} />);
    act(() => {
      vi.advanceTimersByTime(6500 * 2);
    });
    expect(screen.getByText(/Golfo Nuevo — Atardecer/)).toBeInTheDocument();
  });

  it("muestra un indicador por cada escena", () => {
    const { container } = render(<Hero scenes={scenes} />);
    expect(container.querySelectorAll('[role="presentation"] > span')).toHaveLength(2);
  });
});
