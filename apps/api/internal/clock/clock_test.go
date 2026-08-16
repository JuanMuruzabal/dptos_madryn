package clock

import (
	"testing"
	"time"
)

func TestToday_IsMidnightInArgentina(t *testing.T) {
	today := Today()

	if h, m, s := today.Hour(), today.Minute(), today.Second(); h != 0 || m != 0 || s != 0 {
		t.Fatalf("Today() debería ser medianoche, dio %02d:%02d:%02d", h, m, s)
	}

	_, offset := today.Zone()
	if want := -3 * 60 * 60; offset != want {
		t.Fatalf("offset de Argentina esperado %d segundos (UTC-3), dio %d", want, offset)
	}
}

func TestNow_UsesArgentinaOffset(t *testing.T) {
	_, offset := Now().Zone()
	if want := -3 * 60 * 60; offset != want {
		t.Fatalf("offset de Argentina esperado %d segundos (UTC-3), dio %d", want, offset)
	}
}

// Regresión (2026-08-12): ParseDate(hoy) tiene que ser exactamente igual a
// Today(), nunca "antes" — si alguien vuelve a usar time.Parse a secas acá
// (que asume UTC), esta comparación se corre 3 horas y una fecha de hoy
// queda incorrectamente marcada como "en el pasado".
func TestParseDate_MatchesToday(t *testing.T) {
	today := Today()
	parsed, err := ParseDate(today.Format("2006-01-02"))
	if err != nil {
		t.Fatalf("ParseDate devolvió error: %v", err)
	}
	if !parsed.Equal(today) {
		t.Fatalf("ParseDate(hoy) = %v, Today() = %v — deberían ser el mismo instante", parsed, today)
	}
	if parsed.Before(today) {
		t.Fatalf("ParseDate(hoy) quedó antes de Today() — reintrodujo el bug de time.Parse en UTC")
	}
}

// T12.2: cubre el fallback de mustLoadLocation (la rama que solo debería
// dispararse si time/tzdata no tiene la zona embebida) — se llama directo
// porque el test está en el mismo package, no expuesto públicamente.
func TestMustLoadLocation_FallsBackToFixedOffsetOnError(t *testing.T) {
	loc := mustLoadLocation("Esto/No/Es/Una/Zona/Real")
	if loc == nil {
		t.Fatal("mustLoadLocation no debería devolver nil ante un nombre de zona inválido")
	}

	_, offset := time.Now().In(loc).Zone()
	if want := -3 * 60 * 60; offset != want {
		t.Fatalf("el fallback debería quedar en UTC-3 (%d segundos), dio %d", want, offset)
	}
}

// La zona real ("America/Argentina/Buenos_Aires") sí tiene que cargar sin
// pasar por el fallback — si esto alguna vez rompe, es una señal de que
// time/tzdata dejó de estar embebido correctamente en el binario.
func TestMustLoadLocation_LoadsRealZoneWithoutFallback(t *testing.T) {
	loc := mustLoadLocation("America/Argentina/Buenos_Aires")
	if loc.String() != "America/Argentina/Buenos_Aires" {
		t.Fatalf("esperaba la zona real cargada, dio %q — ¿cayó al fallback FixedZone?", loc.String())
	}
}

func TestParseDate_RechazaFormatoInvalido(t *testing.T) {
	if _, err := ParseDate("14-08-2026"); err == nil {
		t.Fatal("ParseDate debería rechazar un formato que no sea YYYY-MM-DD")
	}
}
