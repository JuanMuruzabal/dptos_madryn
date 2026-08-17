import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionToken = vi.fn();
vi.mock("@/lib/session", () => ({ getSessionToken }));

const crearResena = vi.fn();
const borrarResena = vi.fn();
vi.mock("@/lib/api", () => ({ crearResena, borrarResena }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("crearResenaAction", () => {
  it("pide iniciar sesión si no hay token", async () => {
    getSessionToken.mockResolvedValue(null);
    const { crearResenaAction } = await import("./resenas");
    const resultado = await crearResenaAction({}, formData({ alojamientoId: "a-1", rating: "5", texto: "Bien" }));
    expect(resultado.error).toMatch(/iniciá sesión/i);
    expect(crearResena).not.toHaveBeenCalled();
  });

  it("rechaza sin alojamientoId", async () => {
    getSessionToken.mockResolvedValue("token");
    const { crearResenaAction } = await import("./resenas");
    const resultado = await crearResenaAction({}, formData({ rating: "5", texto: "Bien" }));
    expect(resultado.error).toMatch(/alojamiento/i);
  });

  it("rechaza un rating fuera de 1-5", async () => {
    getSessionToken.mockResolvedValue("token");
    const { crearResenaAction } = await import("./resenas");
    for (const rating of ["0", "6", "no-es-numero", "3.5"]) {
      const resultado = await crearResenaAction(
        {},
        formData({ alojamientoId: "a-1", rating, texto: "Bien" }),
      );
      expect(resultado.error).toMatch(/calificación/i);
    }
  });

  it("rechaza texto vacío", async () => {
    getSessionToken.mockResolvedValue("token");
    const { crearResenaAction } = await import("./resenas");
    const resultado = await crearResenaAction(
      {},
      formData({ alojamientoId: "a-1", rating: "5", texto: "   " }),
    );
    expect(resultado.error).toMatch(/escribí/i);
  });

  it("propaga el error del backend (p. ej. sin reserva confirmada)", async () => {
    getSessionToken.mockResolvedValue("token");
    crearResena.mockResolvedValue({ ok: false, status: 403, error: "necesitás una reserva confirmada" });
    const { crearResenaAction } = await import("./resenas");
    const resultado = await crearResenaAction(
      {},
      formData({ alojamientoId: "a-1", rating: "5", texto: "Bien" }),
    );
    expect(resultado.error).toBe("necesitás una reserva confirmada");
  });

  it("éxito devuelve success:true", async () => {
    getSessionToken.mockResolvedValue("token");
    crearResena.mockResolvedValue({ ok: true, data: { id: "r-1" } });
    const { crearResenaAction } = await import("./resenas");
    const resultado = await crearResenaAction(
      {},
      formData({ alojamientoId: "a-1", rating: "5", texto: "Bien" }),
    );
    expect(resultado).toEqual({ success: true });
    expect(crearResena).toHaveBeenCalledWith("token", "a-1", 5, "Bien");
  });
});

describe("borrarResenaAction", () => {
  it("sin token, no llama a la API", async () => {
    getSessionToken.mockResolvedValue(null);
    const { borrarResenaAction } = await import("./resenas");
    await borrarResenaAction("r-1", "a-1");
    expect(borrarResena).not.toHaveBeenCalled();
  });

  it("con token, borra y usa el id y el alojamientoId correctos", async () => {
    getSessionToken.mockResolvedValue("token");
    borrarResena.mockResolvedValue({ ok: true, data: undefined });
    const { borrarResenaAction } = await import("./resenas");
    await borrarResenaAction("r-1", "a-1");
    expect(borrarResena).toHaveBeenCalledWith("token", "r-1");
  });
});
