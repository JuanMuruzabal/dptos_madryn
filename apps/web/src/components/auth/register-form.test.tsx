import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegisterForm } from "./register-form";

const { registerAction } = vi.hoisted(() => ({ registerAction: vi.fn(async () => ({})) }));
vi.mock("@/app/actions/auth", () => ({ registerAction }));

// TurnstileWidget real carga el script de Cloudflare — se mockea con un
// componente que simula la resolución instantánea de la site key de
// PRUEBA (siempre aprueba), controlable por test vía autoApprove: sin
// esto, captchaToken nunca se completa y el submit queda deshabilitado
// para siempre en cualquier test.
const { autoApprove } = vi.hoisted(() => ({ autoApprove: { current: true } }));
vi.mock("@/components/auth/turnstile-widget", () => ({
  TurnstileWidget: ({ onToken }: { onToken: (token: string) => void }) => {
    useEffect(() => {
      if (autoApprove.current) onToken("token-de-prueba");
    }, [onToken]);
    return <div data-testid="turnstile-mock" />;
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  registerAction.mockResolvedValue({});
  autoApprove.current = true;
});

async function completarCamposValidos(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nombre"), "Ana");
  await user.type(screen.getByLabelText("Apellido"), "Pérez");
  await user.type(screen.getByLabelText("Email"), "ana@example.com");
  await user.type(screen.getByLabelText("Confirmar email"), "ana@example.com");
  await user.type(screen.getByLabelText("Contraseña"), "password123");
  await user.type(screen.getByLabelText("Confirmar contraseña"), "password123");
}

describe("RegisterForm", () => {
  it("renderiza los campos del pedido en orden (TR-048, 2026-08-18): Nombre/Apellido, Email, Confirmar email, Teléfono, Contraseña, Confirmar contraseña", () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
    expect(screen.getByLabelText("Apellido")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirmar email")).toBeInTheDocument();
    expect(screen.getByLabelText("Teléfono")).toBeInTheDocument();
    expect(screen.getByLabelText("Código de país")).toHaveValue("+54");
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("minLength", "8");
    expect(screen.getByLabelText("Confirmar contraseña")).toBeInTheDocument();
    expect(screen.queryByLabelText("Usuario")).not.toBeInTheDocument();
  });

  it("el teléfono es opcional (sin required) y muestra el texto de ayuda", () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText("Teléfono")).not.toBeRequired();
    expect(screen.getByText("Código de área + número, sin el 0 ni el 15.")).toBeInTheDocument();
  });

  it("muestra el botón de Google (deshabilitado en test, sin NEXT_PUBLIC_GOOGLE_CLIENT_ID — ver google-signin-button.test.tsx)", () => {
    render(<RegisterForm />);
    expect(screen.getByRole("button", { name: "Ingresá con Google" })).toBeInTheDocument();
  });

  it("con captcha resuelto, el botón de enviar está habilitado", () => {
    render(<RegisterForm />);
    expect(screen.getByRole("button", { name: "Crear cuenta" })).not.toBeDisabled();
  });

  it("sin resolver el captcha, el botón de enviar queda deshabilitado", () => {
    autoApprove.current = false;
    render(<RegisterForm />);
    expect(screen.getByRole("button", { name: "Crear cuenta" })).toBeDisabled();
  });

  it("email y confirmar email distintos: no envía, muestra error propio (sin pegarle al backend)", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await completarCamposValidos(user);
    await user.clear(screen.getByLabelText("Confirmar email"));
    await user.type(screen.getByLabelText("Confirmar email"), "otro@example.com");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Los emails no coinciden.");
    expect(registerAction).not.toHaveBeenCalled();
  });

  it("teléfono con letras: no envía, muestra error propio (el input ya filtra dígitos, pero por las dudas)", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await completarCamposValidos(user);
    await user.type(screen.getByLabelText("Teléfono"), "12abc");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    // El input sanea a solo dígitos ("12"), demasiado corto para el
    // regex de longitud razonable — dispara el mismo error de formato.
    expect(await screen.findByRole("alert")).toHaveTextContent("teléfono válido");
    expect(registerAction).not.toHaveBeenCalled();
  });

  it("contraseña y confirmar contraseña distintas: no envía, muestra error propio", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await completarCamposValidos(user);
    await user.clear(screen.getByLabelText("Confirmar contraseña"));
    await user.type(screen.getByLabelText("Confirmar contraseña"), "otraPassword123");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Las contraseñas no coinciden.");
    expect(registerAction).not.toHaveBeenCalled();
  });

  it("con todo coincidiendo, envía al registerAction", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await completarCamposValidos(user);
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(registerAction).toHaveBeenCalled();
  });

  it("con teléfono válido, también envía", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await completarCamposValidos(user);
    await user.type(screen.getByLabelText("Teléfono"), "2804123456");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(registerAction).toHaveBeenCalled();
  });

  it("muestra el error del backend al fallar el registro", async () => {
    registerAction.mockResolvedValue({ error: "Ese email ya está registrado." });
    const user = userEvent.setup();
    render(<RegisterForm />);
    await completarCamposValidos(user);
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ese email ya está registrado.");
  });
});
