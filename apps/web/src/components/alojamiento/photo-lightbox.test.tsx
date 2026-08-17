import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Foto } from "@turismo-marcuzzi/shared-types";
import { PhotoLightbox } from "./photo-lightbox";

function foto(overrides: Partial<Foto> = {}): Foto {
  return { id: "f-1", url: "http://x/1.jpg", orden: 0, tipo: "foto", esPortada: false, ...overrides };
}

describe("PhotoLightbox", () => {
  it("renderiza la foto en el índice inicial, en un portal (document.body)", () => {
    const fotos = [foto({ id: "f-1", url: "http://x/1.jpg" }), foto({ id: "f-2", url: "http://x/2.jpg" })];
    render(<PhotoLightbox fotos={fotos} nombre="Depto Test" initialIndex={1} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-label", expect.stringContaining("foto 2 de 2"));
  });

  it("un video en el índice activo renderiza <video>, no <img>", () => {
    const fotos = [foto({ id: "f-1", tipo: "video", url: "http://x/v.mp4" })];
    render(<PhotoLightbox fotos={fotos} nombre="Depto Test" initialIndex={0} onClose={vi.fn()} />);
    expect(document.querySelector("video")).toHaveAttribute("src", "http://x/v.mp4");
  });

  it("llama a onClose con Escape, al clickear el fondo, o el botón de cerrar", () => {
    const onClose = vi.fn();
    render(<PhotoLightbox fotos={[foto()]} nombre="Depto Test" initialIndex={0} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("presentation"));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("NO llama a onClose al clickear el diálogo (la foto/video en sí)", () => {
    const onClose = vi.fn();
    render(<PhotoLightbox fotos={[foto()]} nombre="Depto Test" initialIndex={0} onClose={onClose} />);
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("con una sola foto, no muestra flechas de navegación ni el contador", () => {
    render(<PhotoLightbox fotos={[foto()]} nombre="Depto Test" initialIndex={0} onClose={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Foto siguiente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Foto anterior" })).not.toBeInTheDocument();
    expect(screen.queryByText("1 / 1")).not.toBeInTheDocument();
  });

  it("con varias fotos, las flechas y ArrowRight/ArrowLeft navegan (con wraparound)", () => {
    const fotos = [
      foto({ id: "f-1", url: "http://x/1.jpg" }),
      foto({ id: "f-2", url: "http://x/2.jpg" }),
    ];
    render(<PhotoLightbox fotos={fotos} nombre="Depto Test" initialIndex={0} onClose={vi.fn()} />);
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Foto siguiente" }));
    expect(screen.getByText("2 / 2")).toBeInTheDocument();

    // Wraparound: siguiente desde la última vuelve a la primera.
    fireEvent.click(screen.getByRole("button", { name: "Foto siguiente" }));
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    // Wraparound al revés: anterior desde la primera va a la última.
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(screen.getByText("2 / 2")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("las flechas y el contador quedan por encima de la foto (bug real: se tapaban en mobile)", () => {
    const fotos = [foto({ id: "f-1" }), foto({ id: "f-2" })];
    render(<PhotoLightbox fotos={fotos} nombre="Depto Test" initialIndex={0} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Foto anterior" }).className).toContain("z-10");
    expect(screen.getByRole("button", { name: "Foto siguiente" }).className).toContain("z-10");
    expect(screen.getByText("1 / 2").className).toContain("z-10");
  });

  it("clickear una flecha no cierra el lightbox (stopPropagation)", () => {
    const onClose = vi.fn();
    const fotos = [foto({ id: "f-1" }), foto({ id: "f-2" })];
    render(<PhotoLightbox fotos={fotos} nombre="Depto Test" initialIndex={0} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Foto siguiente" }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("bloquea el scroll del body mientras está montado y lo restaura al desmontar", () => {
    document.body.style.overflow = "auto";
    const { unmount } = render(
      <PhotoLightbox fotos={[foto()]} nombre="Depto Test" initialIndex={0} onClose={vi.fn()} />,
    );
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("auto");
  });
});
