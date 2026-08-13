/** Formato de moneda consistente en todo el sitio — spec §4.2 muestra
 * precios en pesos argentinos, sin decimales (los alojamientos se cargan
 * en números redondos). */
const formatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function formatARS(amount: number): string {
  return formatter.format(amount);
}
