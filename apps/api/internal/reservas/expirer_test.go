package reservas

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"turismo-marcuzzi/api/internal/db"
	"turismo-marcuzzi/api/internal/testdb"
)

func fixturesDePrueba(t *testing.T, tx *gorm.DB) (usuarioID, alojamientoID uuid.UUID) {
	t.Helper()
	u := db.Usuario{Nombre: "Test", Email: uuid.NewString() + "@example.com", PasswordHash: "x", Rol: "cliente"}
	if err := tx.Create(&u).Error; err != nil {
		t.Fatalf("no se pudo crear el usuario de prueba: %v", err)
	}
	a := db.Alojamiento{Nombre: "Depto", Lat: -42.7, Lng: -65.0, PrecioNoche: 1000, Capacidad: 2, Activo: true}
	if err := tx.Create(&a).Error; err != nil {
		t.Fatalf("no se pudo crear el alojamiento de prueba: %v", err)
	}
	return u.ID, a.ID
}

// crearPendiente inserta una reserva 'pendiente' con CreatedAt/ContactadoEn
// puestos a mano (no el reloj real) para poder simular "esto se creó hace
// 10 minutos" sin esperar 10 minutos de verdad. fechaInicio/fechaFin son
// distintas en cada llamado (offsetDias) para no chocar con el exclusion
// constraint entre reservas de prueba del mismo test.
func crearPendiente(t *testing.T, tx *gorm.DB, usuarioID, alojamientoID uuid.UUID, offsetDias int, creadaHace time.Duration, contactadaHace *time.Duration) uuid.UUID {
	t.Helper()
	inicio := time.Now().AddDate(0, 0, offsetDias)
	fin := inicio.AddDate(0, 0, 2)
	reserva := db.Reserva{
		UsuarioID:     usuarioID,
		AlojamientoID: &alojamientoID,
		Tipo:          "alojamiento",
		Estado:        "pendiente",
		FechaInicio:   &inicio,
		FechaFin:      &fin,
		CreatedAt:     time.Now().Add(-creadaHace),
	}
	if contactadaHace != nil {
		contactado := time.Now().Add(-*contactadaHace)
		reserva.ContactadoEn = &contactado
	}
	if err := tx.Create(&reserva).Error; err != nil {
		t.Fatalf("no se pudo crear la reserva pendiente de prueba: %v", err)
	}
	return reserva.ID
}

func existe(t *testing.T, tx *gorm.DB, id uuid.UUID) bool {
	t.Helper()
	var count int64
	tx.Model(&db.Reserva{}).Where("id = ?", id).Count(&count)
	return count > 0
}

func TestExpirePendientes_BorraSinContactarVencida(t *testing.T) {
	tx := testdb.New(t)
	u, a := fixturesDePrueba(t, tx)
	id := crearPendiente(t, tx, u, a, 10, ContactoTTL+time.Minute, nil)

	n, err := ExpirePendientes(context.Background(), tx)
	if err != nil {
		t.Fatalf("ExpirePendientes devolvió error: %v", err)
	}
	if n != 1 {
		t.Fatalf("RowsAffected = %d, esperaba 1", n)
	}
	if existe(t, tx, id) {
		t.Fatal("la reserva vencida (sin contactar, más de ContactoTTL) debería haberse borrado")
	}
}

func TestExpirePendientes_NoTocaSinContactarReciente(t *testing.T) {
	tx := testdb.New(t)
	u, a := fixturesDePrueba(t, tx)
	id := crearPendiente(t, tx, u, a, 10, ContactoTTL-time.Minute, nil)

	n, err := ExpirePendientes(context.Background(), tx)
	if err != nil {
		t.Fatalf("ExpirePendientes devolvió error: %v", err)
	}
	if n != 0 {
		t.Fatalf("RowsAffected = %d, esperaba 0", n)
	}
	if !existe(t, tx, id) {
		t.Fatal("una reserva creada hace menos de ContactoTTL no debería borrarse todavía")
	}
}

func TestExpirePendientes_BorraContactadaVencida(t *testing.T) {
	tx := testdb.New(t)
	u, a := fixturesDePrueba(t, tx)
	contactadaHace := ConfirmacionTTL + time.Minute
	// CreatedAt viejo a propósito: una vez contactada, lo que importa es
	// ContactadoEn, no CreatedAt — si el código mirara CreatedAt por error
	// acá, este test lo detectaría (created_at ya pasó ContactoTTL hace
	// rato, pero eso no debería importar más).
	id := crearPendiente(t, tx, u, a, 10, 3*time.Hour, &contactadaHace)

	n, err := ExpirePendientes(context.Background(), tx)
	if err != nil {
		t.Fatalf("ExpirePendientes devolvió error: %v", err)
	}
	if n != 1 {
		t.Fatalf("RowsAffected = %d, esperaba 1", n)
	}
	if existe(t, tx, id) {
		t.Fatal("la reserva contactada hace más de ConfirmacionTTL debería haberse borrado")
	}
}

func TestExpirePendientes_NoTocaContactadaReciente(t *testing.T) {
	tx := testdb.New(t)
	u, a := fixturesDePrueba(t, tx)
	contactadaHace := ConfirmacionTTL - time.Minute
	// CreatedAt viejo a propósito (más de ContactoTTL): una vez contactada,
	// el timer de ContactoTTL ya no aplica, solo ConfirmacionTTL.
	id := crearPendiente(t, tx, u, a, 10, 3*time.Hour, &contactadaHace)

	n, err := ExpirePendientes(context.Background(), tx)
	if err != nil {
		t.Fatalf("ExpirePendientes devolvió error: %v", err)
	}
	if n != 0 {
		t.Fatalf("RowsAffected = %d, esperaba 0", n)
	}
	if !existe(t, tx, id) {
		t.Fatal("una reserva contactada hace menos de ConfirmacionTTL no debería borrarse todavía")
	}
}

func TestExpirePendientes_NoTocaConfirmadas(t *testing.T) {
	tx := testdb.New(t)
	u, a := fixturesDePrueba(t, tx)
	inicio := time.Now().AddDate(0, 0, 10)
	fin := inicio.AddDate(0, 0, 2)
	reserva := db.Reserva{
		UsuarioID: u, AlojamientoID: &a, Tipo: "alojamiento", Estado: "confirmada",
		FechaInicio: &inicio, FechaFin: &fin, CreatedAt: time.Now().Add(-24 * time.Hour),
	}
	if err := tx.Create(&reserva).Error; err != nil {
		t.Fatalf("no se pudo crear la reserva confirmada de prueba: %v", err)
	}

	n, err := ExpirePendientes(context.Background(), tx)
	if err != nil {
		t.Fatalf("ExpirePendientes devolvió error: %v", err)
	}
	if n != 0 {
		t.Fatalf("RowsAffected = %d, esperaba 0 — nunca debería tocar reservas confirmadas", n)
	}
	if !existe(t, tx, reserva.ID) {
		t.Fatal("una reserva confirmada nunca debería borrarse por vencimiento, sin importar su antigüedad")
	}
}

func TestExpirePendientes_NoTocaCanceladas(t *testing.T) {
	tx := testdb.New(t)
	u, a := fixturesDePrueba(t, tx)
	inicio := time.Now().AddDate(0, 0, 10)
	fin := inicio.AddDate(0, 0, 2)
	reserva := db.Reserva{
		UsuarioID: u, AlojamientoID: &a, Tipo: "alojamiento", Estado: "cancelada",
		FechaInicio: &inicio, FechaFin: &fin, CreatedAt: time.Now().Add(-24 * time.Hour),
	}
	if err := tx.Create(&reserva).Error; err != nil {
		t.Fatalf("no se pudo crear la reserva cancelada de prueba: %v", err)
	}

	n, err := ExpirePendientes(context.Background(), tx)
	if err != nil {
		t.Fatalf("ExpirePendientes devolvió error: %v", err)
	}
	if n != 0 {
		t.Fatalf("RowsAffected = %d, esperaba 0", n)
	}
	if !existe(t, tx, reserva.ID) {
		t.Fatal("una reserva ya cancelada no debería tocarse (aunque ExpirePendientes borra, no soft-cancela — no debería ni intentar)")
	}
}

func TestExpirePendientes_CuentaVariasEnUnaSolaPasada(t *testing.T) {
	tx := testdb.New(t)
	u, a := fixturesDePrueba(t, tx)
	crearPendiente(t, tx, u, a, 10, ContactoTTL+time.Minute, nil)
	crearPendiente(t, tx, u, a, 20, ContactoTTL+time.Hour, nil)
	crearPendiente(t, tx, u, a, 30, ContactoTTL-time.Minute, nil) // esta no vence todavía

	n, err := ExpirePendientes(context.Background(), tx)
	if err != nil {
		t.Fatalf("ExpirePendientes devolvió error: %v", err)
	}
	if n != 2 {
		t.Fatalf("RowsAffected = %d, esperaba 2 (solo las 2 vencidas)", n)
	}
}

// RunExpirer corre en su propia goroutine con su propio ticker — usa
// testdb.Shared (conexión real, comprometida) en vez de testdb.New para no
// compartir una misma transacción entre dos goroutines al mismo tiempo
// (mismo motivo que el test de concurrencia de reservas.go, T12.10).
func TestRunExpirer_BorraEnCadaTickHastaQueElContextoSeCancela(t *testing.T) {
	shared := testdb.Shared(t)
	u, a := fixturesDePrueba(t, shared)
	id := crearPendiente(t, shared, u, a, 10, ContactoTTL+time.Minute, nil)
	t.Cleanup(func() {
		shared.Exec("DELETE FROM reservas WHERE id = ?", id) // por si el test falla antes de que RunExpirer la borre
		shared.Exec("DELETE FROM alojamientos WHERE id = ?", a)
		shared.Exec("DELETE FROM usuarios WHERE id = ?", u)
	})

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		RunExpirer(ctx, shared, 10*time.Millisecond)
		close(done)
	}()

	deadline := time.Now().Add(2 * time.Second)
	for existe(t, shared, id) {
		if time.Now().After(deadline) {
			cancel()
			t.Fatal("RunExpirer no borró la reserva vencida dentro del tiempo esperado")
		}
		time.Sleep(20 * time.Millisecond)
	}

	cancel()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("RunExpirer no terminó su goroutine después de cancelar el contexto")
	}
}
