import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmCodeForm } from "./confirm-code-form";

// Firma tipada explícitamente (no vi.fn(async () => ({}))) a propósito:
// sin params, TS infiere las llamadas grabadas como una tupla de longitud
// 0 y mock.calls[0][1] deja de tipar como el FormData real (mismo bug ya
// resuelto en turnstile-widget.test.tsx).
const { confirmarCuentaAction, reenviarCodigoAction } = vi.hoisted(() => ({
  confirmarCuentaAction: vi.fn<(prevState: unknown, formData: FormData) => Promise<{ error?: string }>>(
    async () => ({}),
  ),
  reenviarCodigoAction: vi.fn<
    (prevState: unknown, formData: FormData) => Promise<{ mensaje?: string; error?: string }>
  >(async () => ({})),
}));
vi.mock("@/app/actions/auth", () => ({ confirmarCuentaAction, reenviarCodigoAction }));

beforeEach(() => {
  vi.clearAllMocks();
  confirmarCuentaAction.mockResolvedValue({});
  reenviarCodigoAction.mockResolvedValue({});
});

describe("ConfirmCodeForm", () => {
  it("renderiza el campo de código, el botón de confirmar y el de reenviar", () => {
    render(<ConfirmCodeForm email="ana@example.com" />);
    expect(screen.getByLabelText("Código de confirmación")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar cuenta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reenviar código" })).toBeInTheDocument();
  });

  it("el input de código es editable", () => {
    render(<ConfirmCodeForm email="ana@example.com" />);
    const input = screen.getByLabelText("Código de confirmación");
    fireEvent.change(input, { target: { value: "123456" } });
    expect(input).toHaveValue("123456");
  });

  it("envía el email (oculto, de la URL) y el código escrito a confirmarCuentaAction", async () => {
    const user = userEvent.setup();
    render(<ConfirmCodeForm email="ana@example.com" />);
    await user.type(screen.getByLabelText("Código de confirmación"), "123456");
    await user.click(screen.getByRole("button", { name: "Confirmar cuenta" }));

    expect(confirmarCuentaAction).toHaveBeenCalled();
    const formData = confirmarCuentaAction.mock.calls[0][1] as FormData;
    expect(formData.get("email")).toBe("ana@example.com");
    expect(formData.get("codigo")).toBe("123456");
  });

  it("muestra el error de confirmarCuentaAction si el código es incorrecto", async () => {
    confirmarCuentaAction.mockResolvedValue({ error: "código incorrecto o vencido" });
    const user = userEvent.setup();
    render(<ConfirmCodeForm email="ana@example.com" />);
    await user.type(screen.getByLabelText("Código de confirmación"), "000000");
    await user.click(screen.getByRole("button", { name: "Confirmar cuenta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("código incorrecto o vencido");
  });

  it("reenviar código manda el email y muestra el mensaje genérico que devuelve el backend", async () => {
    reenviarCodigoAction.mockResolvedValue({ mensaje: "si el email existe y no fue confirmado, te mandamos un código nuevo" });
    const user = userEvent.setup();
    render(<ConfirmCodeForm email="ana@example.com" />);
    await user.click(screen.getByRole("button", { name: "Reenviar código" }));

    expect(reenviarCodigoAction).toHaveBeenCalled();
    const formData = reenviarCodigoAction.mock.calls[0][1] as FormData;
    expect(formData.get("email")).toBe("ana@example.com");
    expect(await screen.findByRole("status")).toHaveTextContent(/te mandamos un código nuevo/);
  });

  it("muestra el error de reenviarCodigoAction si falla", async () => {
    reenviarCodigoAction.mockResolvedValue({ error: "ocurrió un error inesperado" });
    const user = userEvent.setup();
    render(<ConfirmCodeForm email="ana@example.com" />);
    await user.click(screen.getByRole("button", { name: "Reenviar código" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("ocurrió un error inesperado");
  });
});
