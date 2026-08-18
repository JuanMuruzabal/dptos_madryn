import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmCodeForm } from "./confirm-code-form";

describe("ConfirmCodeForm", () => {
  it("renderiza el campo de código y el botón de confirmar", () => {
    render(<ConfirmCodeForm />);
    expect(screen.getByLabelText("Código de confirmación")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar cuenta" })).toBeInTheDocument();
  });

  it("el input de código es editable", () => {
    render(<ConfirmCodeForm />);
    const input = screen.getByLabelText("Código de confirmación");
    fireEvent.change(input, { target: { value: "123456" } });
    expect(input).toHaveValue("123456");
  });

  it("muestra el link de reenviar código", () => {
    render(<ConfirmCodeForm />);
    expect(screen.getByRole("button", { name: "Reenviar código" })).toBeInTheDocument();
  });

  it("enviar el form no revienta (solo visual, sin Server Action todavía)", () => {
    render(<ConfirmCodeForm />);
    expect(() =>
      fireEvent.click(screen.getByRole("button", { name: "Confirmar cuenta" })),
    ).not.toThrow();
  });
});
