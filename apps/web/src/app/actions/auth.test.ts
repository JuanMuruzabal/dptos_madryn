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

  it("NO crea sesión — redirige a /registrarse/confirmar con el email (Prompt 2: la cuenta queda pendiente de confirmar)", async () => {
    mockFetchOnce(201, {
      usuario: { id: "u-1", nombre: "Ana Pérez", email: "a@b.com", rol: "cliente" },
      requiereConfirmacion: true,
    });
    const { registerAction } = await import("./auth");

    await expect(registerAction({}, formData(registroValido()))).rejects.toThrow(
      "REDIRECT:/registrarse/confirmar?email=a%40b.com",
    );

    expect(createSession).not.toHaveBeenCalled();
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

  it("el teléfono es opcional; apellido/telefonoCodigo/telefonoNumero sueltos no viajan (van combinados en nombre/telefono)", async () => {
    mockFetchOnce(201, {
      usuario: { id: "u-1", nombre: "Ana Pérez", email: "a@b.com", rol: "cliente" },
      requiereConfirmacion: true,
    });
    const { registerAction } = await import("./auth");

    await expect(registerAction({}, formData(registroValido()))).rejects.toThrow();

    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1]?.body as string) ?? "{}");
    expect(body.telefono).toBeUndefined();
    expect(body.apellido).toBeUndefined();
    expect(body.telefonoCodigo).toBeUndefined();
    expect(body.telefonoNumero).toBeUndefined();
  });

  // Prompt 2 ("Validá también en el backend que los dos campos de email
  // coincidan y que las dos contraseñas coincidan") — a diferencia de
  // TR-048 original, confirmarEmail/confirmarPassword AHORA sí viajan al
  // backend Go, que las vuelve a chequear (defensa en profundidad real,
  // no solo en esta Server Action).
  it("manda confirmarEmail/confirmarPassword al backend (Prompt 2 — antes NO viajaban, TR-048)", async () => {
    mockFetchOnce(201, {
      usuario: { id: "u-1", nombre: "Ana Pérez", email: "a@b.com", rol: "cliente" },
      requiereConfirmacion: true,
    });
    const { registerAction } = await import("./auth");

    await expect(registerAction({}, formData(registroValido()))).rejects.toThrow();

    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1]?.body as string) ?? "{}");
    expect(body.confirmarEmail).toBe("a@b.com");
    expect(body.confirmarPassword).toBe("password123");
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

  // Prompt 2: 403 = cuenta sin confirmar (ver auth.go) — en vez de mostrar
  // un error sin salida, manda directo a la pantalla de confirmación con
  // el email ya cargado.
  it("con 403 del backend (cuenta sin confirmar), redirige a /registrarse/confirmar en vez de mostrar un error", async () => {
    mockFetchOnce(403, { error: "confirmá tu cuenta antes de ingresar — te mandamos un código a tu email" });
    const { loginAction } = await import("./auth");

    await expect(
      loginAction({}, formData({ email: "sinconfirmar@example.com", password: "password123" })),
    ).rejects.toThrow("REDIRECT:/registrarse/confirmar?email=sinconfirmar%40example.com");

    expect(createSession).not.toHaveBeenCalled();
  });
});

describe("confirmarCuentaAction", () => {
  it("rechaza sin email", async () => {
    const { confirmarCuentaAction } = await import("./auth");
    const resultado = await confirmarCuentaAction({}, formData({ codigo: "123456" }));
    expect(resultado.error).toMatch(/email/i);
  });

  it("rechaza sin código", async () => {
    const { confirmarCuentaAction } = await import("./auth");
    const resultado = await confirmarCuentaAction({}, formData({ email: "a@b.com" }));
    expect(resultado.error).toMatch(/código/i);
  });

  it("propaga el error del backend (código incorrecto o vencido)", async () => {
    mockFetchOnce(400, { error: "código incorrecto o vencido" });
    const { confirmarCuentaAction } = await import("./auth");
    const resultado = await confirmarCuentaAction({}, formData({ email: "a@b.com", codigo: "000000" }));
    expect(resultado.error).toBe("código incorrecto o vencido");
  });

  it("crea la sesión y redirige a /perfil en caso de éxito (login automático)", async () => {
    mockFetchOnce(200, { usuario: { id: "u-1", nombre: "Ana", email: "a@b.com", rol: "cliente" }, token: "el-token" });
    const { confirmarCuentaAction } = await import("./auth");

    await expect(
      confirmarCuentaAction({}, formData({ email: "a@b.com", codigo: "123456" })),
    ).rejects.toThrow("REDIRECT:/perfil");

    expect(createSession).toHaveBeenCalledWith("el-token");
  });

  it("manda email y código al backend", async () => {
    mockFetchOnce(200, { usuario: { id: "u-1", nombre: "Ana", email: "a@b.com", rol: "cliente" }, token: "t" });
    const { confirmarCuentaAction } = await import("./auth");

    await expect(
      confirmarCuentaAction({}, formData({ email: "a@b.com", codigo: "123456" })),
    ).rejects.toThrow();

    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1]?.body as string) ?? "{}");
    expect(body).toEqual({ email: "a@b.com", codigo: "123456" });
  });
});

describe("reenviarCodigoAction", () => {
  it("rechaza sin email", async () => {
    const { reenviarCodigoAction } = await import("./auth");
    const resultado = await reenviarCodigoAction({}, formData({}));
    expect(resultado.error).toMatch(/email/i);
  });

  it("devuelve el mensaje genérico del backend en éxito", async () => {
    mockFetchOnce(200, { mensaje: "si el email existe y no fue confirmado todavía, te mandamos un código nuevo" });
    const { reenviarCodigoAction } = await import("./auth");
    const resultado = await reenviarCodigoAction({}, formData({ email: "a@b.com" }));

    expect(resultado.mensaje).toBe("si el email existe y no fue confirmado todavía, te mandamos un código nuevo");
    expect(resultado.error).toBeUndefined();
  });

  it("propaga un error del backend si lo hay", async () => {
    mockFetchOnce(500, { error: "ocurrió un error inesperado" });
    const { reenviarCodigoAction } = await import("./auth");
    const resultado = await reenviarCodigoAction({}, formData({ email: "a@b.com" }));

    expect(resultado.error).toBe("ocurrió un error inesperado");
  });

  it("no crea sesión ni redirige — se queda en la misma pantalla", async () => {
    mockFetchOnce(200, { mensaje: "listo" });
    const { reenviarCodigoAction } = await import("./auth");
    await reenviarCodigoAction({}, formData({ email: "a@b.com" }));

    expect(createSession).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("googleLoginAction", () => {
  it("crea la sesión y redirige a /perfil en caso de éxito", async () => {
    mockFetchOnce(200, { usuario: { id: "u-1", nombre: "Ana", email: "a@gmail.com", rol: "cliente" }, token: "el-token" });
    const { googleLoginAction } = await import("./auth");

    await expect(googleLoginAction("el-code")).rejects.toThrow("REDIRECT:/perfil");

    expect(createSession).toHaveBeenCalledWith("el-token");
  });

  it("manda el code al backend", async () => {
    mockFetchOnce(200, { usuario: { id: "u-1", nombre: "Ana", email: "a@gmail.com", rol: "cliente" }, token: "t" });
    const { googleLoginAction } = await import("./auth");

    await expect(googleLoginAction("el-code")).rejects.toThrow();

    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1]?.body as string) ?? "{}");
    expect(body).toEqual({ code: "el-code" });
  });

  it("devuelve el error del backend sin redirigir si el code es inválido", async () => {
    mockFetchOnce(400, { error: "no pudimos verificar tu cuenta de Google — probá de nuevo" });
    const { googleLoginAction } = await import("./auth");

    const resultado = await googleLoginAction("code-invalido");

    expect(resultado.error).toBe("no pudimos verificar tu cuenta de Google — probá de nuevo");
    expect(createSession).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("logoutAction", () => {
  it("borra la sesión y redirige a /", async () => {
    const { logoutAction } = await import("./auth");
    await expect(logoutAction()).rejects.toThrow("REDIRECT:/");
    expect(deleteSession).toHaveBeenCalled();
  });
});
