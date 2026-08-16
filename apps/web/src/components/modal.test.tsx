import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Modal } from "./modal";

describe("Modal", () => {
  it("renderiza los children en un portal (document.body)", () => {
    render(
      <Modal onClose={vi.fn()} labelledBy="titulo-test">
        <h2 id="titulo-test">Título del modal</h2>
      </Modal>,
    );
    expect(screen.getByText("Título del modal")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("llama a onClose al tocar Escape", () => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose} labelledBy="t">
        <p id="t">Contenido</p>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("no llama a onClose con otra tecla", () => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose} labelledBy="t">
        <p id="t">Contenido</p>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: "Enter" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("llama a onClose al clickear el fondo", () => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose} labelledBy="t">
        <p id="t">Contenido</p>
      </Modal>,
    );
    fireEvent.click(screen.getByRole("presentation"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("NO llama a onClose al clickear el contenido del diálogo", () => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose} labelledBy="t">
        <p id="t">Contenido</p>
      </Modal>,
    );
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("bloquea el scroll del body mientras está montado y lo restaura al desmontar", () => {
    document.body.style.overflow = "auto";
    const { unmount } = render(
      <Modal onClose={vi.fn()} labelledBy="t">
        <p id="t">Contenido</p>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("auto");
  });
});
