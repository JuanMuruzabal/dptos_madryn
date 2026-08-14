import { describe, expect, it } from "vitest";
import { CONTACTO_EMAIL, CONTACTO_TELEFONO_LEGIBLE, mailtoUrl, telUrl, whatsappUrl } from "./contacto";

describe("contacto", () => {
  it("CONTACTO_TELEFONO_LEGIBLE antepone un + al número", () => {
    expect(CONTACTO_TELEFONO_LEGIBLE.startsWith("+")).toBe(true);
  });

  it("CONTACTO_EMAIL cae al placeholder cuando no hay env var", () => {
    expect(CONTACTO_EMAIL).toBe("hola@turismomarcuzzi.com.ar");
  });

  it("whatsappUrl arma un link wa.me con el mensaje codificado", () => {
    const url = whatsappUrl("Hola, reservé el depto");
    expect(url).toContain("https://wa.me/");
    expect(url).toContain(encodeURIComponent("Hola, reservé el depto"));
  });

  it("mailtoUrl arma un link mailto con asunto y cuerpo codificados", () => {
    const url = mailtoUrl("Reserva confirmada", "Detalle de la reserva");
    expect(url).toMatch(/^mailto:/);
    expect(url).toContain(`subject=${encodeURIComponent("Reserva confirmada")}`);
    expect(url).toContain(`body=${encodeURIComponent("Detalle de la reserva")}`);
  });

  it("telUrl arma un link tel: con el número con +", () => {
    expect(telUrl()).toMatch(/^tel:\+\d+$/);
  });
});
