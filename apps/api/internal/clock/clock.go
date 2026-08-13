// Package clock centraliza "qué hora/fecha es hoy" en la zona horaria de
// Argentina, para no depender de la zona horaria del contenedor donde
// corre el proceso (Railway/Fly.io suelen correr en UTC por defecto).
//
// Existe específicamente para FR-11 (acceso a servicios atado a alojamiento
// confirmado vigente, ver docs/tradeoffs.md TR-007): comparar
// `fecha_fin >= hoy` con la hora local del servidor sin fijar zona horaria
// puede desbloquear o bloquear a un huésped un día antes o después de lo
// esperado (riesgo R8 en docs/implementation-plan.md). Todo el código que
// necesite "la fecha de hoy" para ese tipo de comparación debe usar este
// paquete en vez de time.Now() directo.
package clock

import (
	"time"

	// Empaqueta la base de datos de zonas horarias IANA en el binario, para
	// que LoadLocation funcione aunque el contenedor de deploy no tenga
	// /usr/share/zoneinfo instalado (común en imágenes mínimas).
	_ "time/tzdata"
)

// Argentina no tiene horario de verano desde 2009: un único offset fijo
// (UTC-3) en todo el país, incluida la Patagonia. Cualquier zona
// "America/Argentina/*" da el mismo resultado; Buenos_Aires es la canónica.
var location = mustLoadLocation("America/Argentina/Buenos_Aires")

func mustLoadLocation(name string) *time.Location {
	loc, err := time.LoadLocation(name)
	if err != nil {
		// No debería pasar con time/tzdata embebido, pero si pasa preferimos
		// un offset fijo correcto antes que reventar el arranque del backend.
		return time.FixedZone("ART", -3*60*60)
	}
	return loc
}

// Now devuelve el instante actual en la zona horaria de Argentina.
func Now() time.Time {
	return time.Now().In(location)
}

// Today devuelve la fecha calendario de hoy en Argentina, a medianoche —
// comparable directamente contra columnas `date` de Postgres (p. ej.
// reservas.fecha_fin) sin que la hora del día interfiera en la comparación.
func Today() time.Time {
	now := Now()
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location)
}

// ParseDate interpreta un string "YYYY-MM-DD" como medianoche en Argentina
// — nunca uses time.Parse a secas para esto. time.Parse sin zona horaria
// en el layout asume UTC, así que comparar ese resultado contra Today()
// (Argentina, UTC-3) corre la fecha 3 horas: un check-in para "hoy" queda
// 3 horas *antes* de la medianoche argentina de hoy y el `.Before()` da
// true — rechaza como "en el pasado" una fecha que en realidad es hoy
// (bug real, encontrado 2026-08-12). ParseDate y Today() quedan siempre
// en la misma zona horaria, así que son comparables de forma segura.
func ParseDate(value string) (time.Time, error) {
	return time.ParseInLocation("2006-01-02", value, location)
}
