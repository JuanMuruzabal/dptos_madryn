import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionToken = vi.fn();
vi.mock("@/lib/session", () => ({ getSessionToken }));

const crearReserva = vi.fn();
const marcarContactado = vi.fn();
vi.mock("@/lib/api", () => ({ crearReserva, marcarContactado }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const contacto = {
  contactoNombre: "Ana",
  contactoApellido: "Test",
  contactoDni: "12345678",
  contactoEmail: "ana@example.com",
  contactoTelefono: "1122334455",
};

describe("crearReservaAction", () => {
  it("pide iniciar sesión si no hay token", async () => {
    getSessionToken.mockResolvedValue(null);
    const { crearReservaAction } = await import("./reservas");
    const resultado = await crearReservaAction({}, formData({ alojamientoId: "a-1", fechaInicio: "2026-09-01", fechaFin: "2026-09-05" }));
    expect(resultado.error).toMatch(/iniciá sesión/i);
  });

  it("rechaza sin fechas elegidas", async () => {
    getSessionToken.mockResolvedValue("token");
    const { crearReservaAction } = await import("./reservas");
    const resultado = await crearReservaAction({}, formData({ alojamientoId: "a-1" }));
    expect(resultado.error).toMatch(/check-in/i);
  });

  it("propaga el error del backend (p. ej. fechas solapadas)", async () => {
    getSessionToken.mockResolvedValue("token");
    crearReserva.mockResolvedValue({ ok: false, status: 409, error: "esas fechas ya no están disponibles" });
    const { crearReservaAction } = await import("./reservas");
    const resultado = await crearReservaAction(
      {},
      formData({ alojamientoId: "a-1", fechaInicio: "2026-09-01", fechaFin: "2026-09-05", ...contacto }),
    );
    expect(resultado.error).toBe("esas fechas ya no están disponibles");
  });

  it("éxito devuelve reservaId y expiraEn", async () => {
    getSessionToken.mockResolvedValue("token");
    crearReserva.mockResolvedValue({ ok: true, data: { id: "r-1", expiraEn: "2026-09-01T00:05:00Z" } });
    const { crearReservaAction } = await import("./reservas");
    const resultado = await crearReservaAction(
      {},
      formData({ alojamientoId: "a-1", fechaInicio: "2026-09-01", fechaFin: "2026-09-05", ...contacto }),
    );
    expect(resultado).toEqual({ success: true, reservaId: "r-1", expiraEn: "2026-09-01T00:05:00Z" });
  });

  it("recorta espacios de los datos de contacto antes de mandarlos", async () => {
    getSessionToken.mockResolvedValue("token");
    crearReserva.mockResolvedValue({ ok: true, data: { id: "r-1" } });
    const { crearReservaAction } = await import("./reservas");
    await crearReservaAction(
      {},
      formData({
        alojamientoId: "a-1", fechaInicio: "2026-09-01", fechaFin: "2026-09-05",
        contactoNombre: "  Ana  ", contactoApellido: "Test", contactoDni: "12345678",
        contactoEmail: "ana@example.com", contactoTelefono: "1122334455",
      }),
    );
    expect(crearReserva).toHaveBeenCalledWith(
      "token", "a-1", "2026-09-01", "2026-09-05",
      expect.objectContaining({ contactoNombre: "Ana" }),
    );
  });
});

describe("marcarContactadoAction", () => {
  it("no hace nada sin token", async () => {
    getSessionToken.mockResolvedValue(null);
    const { marcarContactadoAction } = await import("./reservas");
    await marcarContactadoAction("r-1");
    expect(marcarContactado).not.toHaveBeenCalled();
  });

  it("llama a marcarContactado con el token y el id", async () => {
    getSessionToken.mockResolvedValue("token");
    const { marcarContactadoAction } = await import("./reservas");
    await marcarContactadoAction("r-1");
    expect(marcarContactado).toHaveBeenCalledWith("token", "r-1");
  });
});
