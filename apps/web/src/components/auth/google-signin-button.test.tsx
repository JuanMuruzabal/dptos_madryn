import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { googleLoginAction } = vi.hoisted(() => ({ googleLoginAction: vi.fn(async () => ({})) }));
vi.mock("@/app/actions/auth", () => ({ googleLoginAction }));

// next/script no dispara su ciclo real de carga fuera del runtime de
// Next.js — se mockea igual que turnstile-widget.test.tsx.
vi.mock("next/script", () => ({
  default: function MockScript({ onReady }: { onReady?: () => void }) {
    useEffect(() => {
      onReady?.();
    }, [onReady]);
    return null;
  },
}));

const ORIGINAL_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

beforeEach(() => {
  vi.clearAllMocks();
  googleLoginAction.mockResolvedValue({});
  delete window.google;
});

afterEach(() => {
  if (ORIGINAL_CLIENT_ID === undefined) {
    delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  } else {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = ORIGINAL_CLIENT_ID;
  }
  vi.resetModules();
});

// GOOGLE_CLIENT_ID se lee una sola vez al importar el módulo (const de
// nivel de archivo) — para probar los dos casos (configurado/sin
// configurar) hay que resetear módulos y reimportar con el env ya
// seteado antes del import, no después.
async function renderConfigurado() {
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "mi-client-id";
  vi.resetModules();
  const { GoogleSignInButton } = await import("./google-signin-button");
  return render(<GoogleSignInButton />);
}

describe("GoogleSignInButton", () => {
  it("sin NEXT_PUBLIC_GOOGLE_CLIENT_ID, el botón queda deshabilitado (visible, no roto)", async () => {
    delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    vi.resetModules();
    const { GoogleSignInButton } = await import("./google-signin-button");
    render(<GoogleSignInButton />);

    expect(screen.getByRole("button", { name: "Ingresá con Google" })).toBeDisabled();
  });

  it("con NEXT_PUBLIC_GOOGLE_CLIENT_ID, el botón queda habilitado", async () => {
    await renderConfigurado();
    await waitFor(() => expect(screen.getByRole("button", { name: "Ingresá con Google" })).not.toBeDisabled());
  });

  it("al hacer click, arma el cliente de Google (Authorization Code, modo popup) y pide el code", async () => {
    const requestCode = vi.fn();
    const initCodeClient = vi.fn(() => ({ requestCode }));
    window.google = { accounts: { oauth2: { initCodeClient } } };

    await renderConfigurado();
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByRole("button", { name: "Ingresá con Google" })).not.toBeDisabled());
    await user.click(screen.getByRole("button", { name: "Ingresá con Google" }));

    expect(initCodeClient).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: "mi-client-id", ux_mode: "popup" }),
    );
    expect(requestCode).toHaveBeenCalledTimes(1);
  });

  it("con un code exitoso, llama a googleLoginAction con ese code", async () => {
    let capturado: ((r: { code?: string; error?: string }) => void) | undefined;
    const initCodeClient = vi.fn((config: { callback: (r: { code?: string }) => void }) => {
      capturado = config.callback;
      return { requestCode: vi.fn() };
    });
    window.google = { accounts: { oauth2: { initCodeClient } } };

    await renderConfigurado();
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByRole("button", { name: "Ingresá con Google" })).not.toBeDisabled());
    await user.click(screen.getByRole("button", { name: "Ingresá con Google" }));
    capturado?.({ code: "el-code" });

    await waitFor(() => expect(googleLoginAction).toHaveBeenCalledWith("el-code"));
  });

  it("sin code (p. ej. el usuario cerró el popup), muestra un error y no llama al backend", async () => {
    let capturado: ((r: { code?: string; error?: string }) => void) | undefined;
    const initCodeClient = vi.fn((config: { callback: (r: { code?: string }) => void }) => {
      capturado = config.callback;
      return { requestCode: vi.fn() };
    });
    window.google = { accounts: { oauth2: { initCodeClient } } };

    await renderConfigurado();
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByRole("button", { name: "Ingresá con Google" })).not.toBeDisabled());
    await user.click(screen.getByRole("button", { name: "Ingresá con Google" }));
    capturado?.({ error: "popup_closed" });

    expect(await screen.findByRole("alert")).toHaveTextContent(/no pudimos completar/i);
    expect(googleLoginAction).not.toHaveBeenCalled();
  });

  it("si googleLoginAction devuelve error (backend rechazó el code), lo muestra", async () => {
    googleLoginAction.mockResolvedValue({ error: "no pudimos verificar tu cuenta de Google" });
    let capturado: ((r: { code?: string; error?: string }) => void) | undefined;
    const initCodeClient = vi.fn((config: { callback: (r: { code?: string }) => void }) => {
      capturado = config.callback;
      return { requestCode: vi.fn() };
    });
    window.google = { accounts: { oauth2: { initCodeClient } } };

    await renderConfigurado();
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByRole("button", { name: "Ingresá con Google" })).not.toBeDisabled());
    await user.click(screen.getByRole("button", { name: "Ingresá con Google" }));
    capturado?.({ code: "el-code" });

    expect(await screen.findByRole("alert")).toHaveTextContent("no pudimos verificar tu cuenta de Google");
  });
});
