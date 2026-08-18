import { beforeEach, describe, expect, it, vi } from "vitest";

const createSession = vi.fn();
const deleteSession = vi.fn();
vi.mock("@/lib/session", () => ({ createSession, deleteSession }));

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function mockFetchOnce(status: number, body: unknown, ok = status >= 200 && status < 300) {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response);
}

// Campos válidos completos (2026-08-18, TR-048: Nombre/Apellido/Email/
// Confirmar email/Teléfono/Contraseña/Confirmar contraseña/captchaToken)
// — el helper evita repetir todos los campos en cada test que solo
// quiere variar uno. telefonoCodigo/telefonoNumero quedan vacíos por
// default (el teléfono es opcional), como si el usuario no lo hubiera
// tocado.
function registroValido(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    nombre: "Ana",
    apellido: "Pérez",
    email: "a@b.com",
    confirmarEmail: "a@b.com",
    password: "password123",
    confirmarPassword: "password123",
    captchaToken: "token-de-prueba",
    ...overrides,
  };
}

describe("registerAction", () => {
  it("rechaza sin nombre", async () => {
    const { registerAction } = await import("./auth");
    const resultado = await registerAction({}, formData(registroValido({ nombre: "" })));
    expect(resultado.error).toMatch(/nombre/i);
  });

  it("rechaza sin apellido", async () => {
    const { registerAction } = await import("./auth");
    const resultado = await registerAction({}, formData(registroValido({ apellido: "" })));
    expect(resultado.error).toMatch(/apellido/i);
  });

  it("rechaza un email sin @", async () => {
    const { registerAction } = await import("./auth");
    const resultado = await registerAction(
      {},
      formData(registroValido({ email: "no-es-email", confirmarEmail: "no-es-email" })),
    );
    expect(resultado.error).toMatch(/email/i);
  });

  it("rechaza si el email y su confirmación no coinciden", async () => {
    const { registerAction } = await import("./auth");
    const resultado = await registerAction(
      {},
      formData(registroValido({ confirmarEmail: "otro@b.com" })),
    );
    expect(resultado.error).toMatch(/emails no coinciden/i);
  });

  it("rechaza una password corta", async () => {
    const { registerAction } = await import("./auth");
    const resultado = await registerAction(
      {},
      formData(registroValido({ password: "corta", confirmarPassword: "corta" })),
    );
    expect(resultado.error).toMatch(/8 caracteres/);
  });

  it("rechaza si la contraseña y su confirmación no coinciden", async () => {
    const { registerAction } = await import("./auth");
    const resultado = await registerAction(
      {},
      formData(registroValido({ confirmarPassword: "otraPassword123" })),
    );
    expect(resultado.error).toMatch(/contraseñas no coinciden/i);
  });

  it("rechaza sin token de captcha", async () => {
    const { registerAction } = await import("./auth");
    const resultado = await registerAction({}, formData(registroValido({ captchaToken: "" })));
    expect(resultado.error).toMatch(/verificación anti-bot/i);
  });

  it("propaga el error del backend (p. ej. email duplicado)", async () => {
    mockFetchOnce(409, { error: "ya existe una cuenta con ese email" });
    const { registerAction } = await import("./auth");
    const resultado = await registerAction({}, formData(registroValido()));
    expect(resultado.error).toBe("ya existe una cuenta con ese email");
  });

  it("crea la sesión y redirige a /perfil en caso de éxito", async () => {
    mockFetchOnce(201, { usuario: { id: "u-1", nombre: "Ana", email: "a@b.com", rol: "cliente" }, token: "el-token" });
    const { registerAction } = await import("./auth");

    await expect(registerAction({}, formData(registroValido()))).rejects.toThrow("REDIRECT:/perfil");

    expect(createSession).toHaveBeenCalledWith("el-token");
  });

  it("manda el captchaToken al backend", async () => {
    mockFetchOnce(201, { usuario: { id: "u-1", nombre: "Ana", email: "a@b.com", rol: "cliente" }, token: "t" });
    const { registerAction } = await import("./auth");

    await expect(
      registerAction({}, formData(registroValido({ captchaToken: "token-real" }))),
    ).rejects.toThrow();

    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1]?.body as string) ?? "{}");
    expect(body.captchaToken).toBe("token-real");
  });

  it("el teléfono es opcional (y confirmarEmail/confirmarPassword/apellido/telefonoCodigo/telefonoNumero sueltos no viajan al backend)", async () => {
    mockFetchOnce(201, { usuario: { id: "u-1", nombre: "Ana", email: "a@b.com", rol: "cliente" }, token: "t" });
    const { registerAction } = await import("./auth");

    await expect(registerAction({}, formData(registroValido()))).rejects.toThrow();

    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1]?.body as string) ?? "{}");
    expect(body.telefono).toBeUndefined();
    expect(body.confirmarEmail).toBeUndefined();
    expect(body.confirmarPassword).toBeUndefined();
    expect(body.apellido).toBeUndefined();
    expect(body.telefonoCodigo).toBeUndefined();
    expect(body.telefonoNumero).toBeUndefined();
  });

  it("combina nombre + apellido en un solo campo nombre para el backend (2026-08-18)", async () => {
    mockFetchOnce(201, { usuario: { id: "u-1", nombre: "Ana Pérez", email: "a@b.com", rol: "cliente" }, token: "t" });
    const { registerAction } = await import("./auth");

    await expect(registerAction({}, formData(registroValido()))).rejects.toThrow();

    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1]?.body as string) ?? "{}");
    expect(body.nombre).toBe("Ana Pérez");
  });

  it("une código de país + número en formato internacional para telefono (2026-08-18)", async () => {
    mockFetchOnce(201, { usuario: { id: "u-1", nombre: "Ana", email: "a@b.com", rol: "cliente" }, token: "t" });
    const { registerAction } = await import("./auth");

    await expect(
      registerAction(
        {},
        formData(registroValido({ telefonoCodigo: "+54", telefonoNumero: "2804123456" })),
      ),
    ).rejects.toThrow();

    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1]?.body as string) ?? "{}");
    expect(body.telefono).toBe("+542804123456");
  });

  it("rechaza un teléfono con formato inválido (no solo dígitos, o muy corto)", async () => {
    const { registerAction } = await import("./auth");
    const resultado = await registerAction(
      {},
      formData(registroValido({ telefonoCodigo: "+54", telefonoNumero: "123" })),
    );
    expect(resultado.error).toMatch(/teléfono válido/i);
  });
});

describe("loginAction", () => {
  it("rechaza sin email o password", async () => {
    const { loginAction } = await import("./auth");
    expect((await loginAction({}, formData({ email: "a@b.com" }))).error).toBeTruthy();
    expect((await loginAction({}, formData({ password: "x" }))).error).toBeTruthy();
  });

  it("propaga credenciales inválidas del backend", async () => {
    mockFetchOnce(401, { error: "email o contraseña inválidos" });
    const { loginAction } = await import("./auth");
    const resultado = await loginAction({}, formData({ email: "a@b.com", password: "mal" }));
    expect(resultado.error).toBe("email o contraseña inválidos");
  });

  it("crea la sesión y redirige a /perfil en caso de éxito", async () => {
    mockFetchOnce(200, { usuario: { id: "u-1", nombre: "Ana", email: "a@b.com", rol: "cliente" }, token: "el-token" });
    const { loginAction } = await import("./auth");

    await expect(loginAction({}, formData({ email: "a@b.com", password: "password123" }))).rejects.toThrow(
      "REDIRECT:/perfil",
    );
    expect(createSession).toHaveBeenCalledWith("el-token");
  });
});

describe("logoutAction", () => {
  it("borra la sesión y redirige a /", async () => {
    const { logoutAction } = await import("./auth");
    await expect(logoutAction()).rejects.toThrow("REDIRECT:/");
    expect(deleteSession).toHaveBeenCalled();
  });
});
