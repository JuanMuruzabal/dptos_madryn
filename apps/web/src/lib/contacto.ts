/**
 * Datos de contacto del dueño para el botón de WhatsApp/mail que aparece
 * al reservar (T3.5). Sin dato real del cliente todavía — mismo patrón de
 * placeholder por variable de entorno que ya usamos para storage/email
 * (TR-013/TR-014). El footer (site-footer.tsx) ya tenía un TODO idéntico
 * para el mail; el de WhatsApp es nuevo acá.
 */
const CONTACTO_WHATSAPP = process.env.CONTACTO_WHATSAPP ?? "5492804000000";
export const CONTACTO_EMAIL = process.env.CONTACTO_EMAIL ?? "hola@turismomarcuzzi.com.ar";
/** Formato legible para mostrar en texto (p. ej. "llamá al ...") — el de
 * arriba (CONTACTO_WHATSAPP) es el que necesitan los links wa.me/tel:,
 * sin "+" ni espacios. */
export const CONTACTO_TELEFONO_LEGIBLE = `+${CONTACTO_WHATSAPP}`;

/** Link de WhatsApp con el mensaje precargado — así el dueño ya ve de
 * entrada de qué reserva se trata, sin esperar al panel admin (Sprint 4). */
export function whatsappUrl(mensaje: string): string {
  return `https://wa.me/${CONTACTO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
}

export function mailtoUrl(asunto: string, mensaje: string): string {
  return `mailto:${CONTACTO_EMAIL}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensaje)}`;
}

/** Link de llamada (T3.7) — para "si tarda, llamá a tal número" en la
 * fase de espera de confirmación (2h). Mismo número que WhatsApp: es un
 * celular, no una línea separada. */
export function telUrl(): string {
  return `tel:+${CONTACTO_WHATSAPP}`;
}
