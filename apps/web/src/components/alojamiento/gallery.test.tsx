import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Foto } from "@turismo-marcuzzi/shared-types";
import { Gallery } from "./gallery";

function foto(overrides: Partial<Foto> = {}): Foto {
  return { id: "f-1", url: "http://x/1.jpg", orden: 0, tipo: "foto", esPortada: false, ...overrides };
}

describe("Gallery", () => {
  it("sin fotos, cae al placeholder de gradiente", () => {
    render(<Gallery fotos={[]} nombre="Depto Test" placeholderSeed="a-1" />);
    expect(screen.getByRole("img", { name: "Depto Test" })).toHaveClass("photo-placeholder");
  });

  it("con una sola foto, no muestra la tira de miniaturas", () => {
    render(<Gallery fotos={[foto()]} nombre="Depto Test" placeholderSeed="a-1" />);
    // Las miniaturas tienen el patrón "Ver foto/video N de M" — el botón
    // de pantalla completa (2026-08-17) también arranca con "Ver" pero no
    // termina en "de M", por eso el regex es más específico acá.
    expect(screen.queryByRole("button", { name: /^Ver (foto|video) \d+ de \d+$/ })).not.toBeInTheDocument();
  });

  it("una foto activa de tipo video renderiza un <video>", () => {
    render(<Gallery fotos={[foto({ tipo: "video" })]} nombre="Depto Test" placeholderSeed="a-1" />);
    expect(document.querySelector("video")).toHaveAttribute("src", "http://x/1.jpg");
  });

  it("una foto activa de tipo foto renderiza un <img>", () => {
    render(<Gallery fotos={[foto()]} nombre="Depto Test" placeholderSeed="a-1" />);
    expect(screen.getByRole("img", { name: /Depto Test — foto 1 de 1/ })).toBeInTheDocument();
  });

  it("con varias fotos, muestra una miniatura por cada una y permite cambiar la activa", () => {
    const fotos = [foto({ id: "f-1", url: "http://x/1.jpg" }), foto({ id: "f-2", url: "http://x/2.jpg", orden: 1 })];
    render(<Gallery fotos={fotos} nombre="Depto Test" placeholderSeed="a-1" />);

    expect(screen.getByRole("img", { name: /foto 1 de 2/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver foto 2 de 2" }));
    expect(screen.getByRole("img", { name: /foto 2 de 2/ })).toBeInTheDocument();
  });

  it("una miniatura de video muestra un ícono de play en vez de <img>", () => {
    const fotos = [foto({ id: "f-1" }), foto({ id: "f-2", tipo: "video", orden: 1 })];
    render(<Gallery fotos={fotos} nombre="Depto Test" placeholderSeed="a-1" />);
    expect(screen.getByRole("button", { name: "Ver video 2 de 2" })).toBeInTheDocument();
  });

  describe("pantalla completa (2026-08-17, pedido del cliente)", () => {
    it("clickear el ícono de expandir abre el lightbox en la foto activa", () => {
      const fotos = [foto({ id: "f-1", url: "http://x/1.jpg" }), foto({ id: "f-2", url: "http://x/2.jpg", orden: 1 })];
      render(<Gallery fotos={fotos} nombre="Depto Test" placeholderSeed="a-1" />);

      fireEvent.click(screen.getByRole("button", { name: "Ver foto 2 de 2" }));
      fireEvent.click(screen.getByRole("button", { name: "Ver foto en pantalla completa" }));

      expect(screen.getByRole("dialog")).toHaveAttribute("aria-label", expect.stringContaining("foto 2 de 2"));
    });

    it("con una foto (tipo foto), toda el área de la imagen también abre el lightbox", () => {
      render(<Gallery fotos={[foto()]} nombre="Depto Test" placeholderSeed="a-1" />);
      fireEvent.click(screen.getByRole("button", { name: "Ver foto en pantalla completa" }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("con un video, solo el ícono abre el lightbox (no hay botón de área completa)", () => {
      render(<Gallery fotos={[foto({ tipo: "video" })]} nombre="Depto Test" placeholderSeed="a-1" />);
      // El botón de "toda el área" (sin nombre propio, solapado al video)
      // no existe para video — solo el ícono explícito.
      expect(screen.getByRole("button", { name: "Ver video en pantalla completa" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Ver video en pantalla completa" }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("cerrar el lightbox lo saca del documento", () => {
      render(<Gallery fotos={[foto()]} nombre="Depto Test" placeholderSeed="a-1" />);
      fireEvent.click(screen.getByRole("button", { name: "Ver foto en pantalla completa" }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
