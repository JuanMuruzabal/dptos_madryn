package usuarios

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"turismo-marcuzzi/api/internal/db"
	"turismo-marcuzzi/api/internal/testdb"
)

// crearSinConfirmar inserta un Usuario con EmailConfirmado=false y
// CodigoExpiracion puesto a mano (no el reloj real) para poder simular
// "el código venció hace X" sin esperar tiempo real.
func crearSinConfirmar(t *testing.T, tx *gorm.DB, vencioHace time.Duration) uuid.UUID {
	t.Helper()
	expiracion := time.Now().Add(-vencioHace)
	codigo := "123456"
	u := db.Usuario{
		Nombre: "Test", Email: uuid.NewString() + "@example.com", PasswordHash: "x", Rol: "cliente",
		EmailConfirmado: false, CodigoConfirmacion: &codigo, CodigoExpiracion: &expiracion,
	}
	if err := tx.Create(&u).Error; err != nil {
		t.Fatalf("no se pudo crear el usuario de prueba: %v", err)
	}
	return u.ID
}

func existe(t *testing.T, tx *gorm.DB, id uuid.UUID) bool {
	t.Helper()
	var count int64
	tx.Model(&db.Usuario{}).Where("id = ?", id).Count(&count)
	return count > 0
}

func TestExpireSinConfirmar_BorraLasVencidasHaceMasDeLaGracia(t *testing.T) {
	tx := testdb.New(t)
	id := crearSinConfirmar(t, tx, GraciaTrasVencimiento+time.Hour)

	n, err := ExpireSinConfirmar(context.Background(), tx)
	if err != nil {
		t.Fatalf("ExpireSinConfirmar devolvió error: %v", err)
	}
	if n != 1 {
		t.Fatalf("RowsAffected = %d, esperaba 1", n)
	}
	if existe(t, tx, id) {
		t.Fatal("una cuenta sin confirmar vencida hace más de la gracia debería haberse borrado")
	}
}

func TestExpireSinConfirmar_NoTocaLasVencidasHaceMenosDeLaGracia(t *testing.T) {
	tx := testdb.New(t)
	id := crearSinConfirmar(t, tx, GraciaTrasVencimiento-time.Hour)

	n, err := ExpireSinConfirmar(context.Background(), tx)
	if err != nil {
		t.Fatalf("ExpireSinConfirmar devolvió error: %v", err)
	}
	if n != 0 {
		t.Fatalf("RowsAffected = %d, esperaba 0", n)
	}
	if !existe(t, tx, id) {
		t.Fatal("una cuenta sin confirmar todavía dentro del margen de gracia no debería borrarse")
	}
}

func TestExpireSinConfirmar_NoTocaCuentasRecienRegistradas(t *testing.T) {
	tx := testdb.New(t)
	// Código recién generado, vence en el futuro (15 min típico) — ni
	// siquiera venció todavía, mucho menos hace más de la gracia.
	id := crearSinConfirmar(t, tx, -15*time.Minute)

	n, err := ExpireSinConfirmar(context.Background(), tx)
	if err != nil {
		t.Fatalf("ExpireSinConfirmar devolvió error: %v", err)
	}
	if n != 0 {
		t.Fatalf("RowsAffected = %d, esperaba 0", n)
	}
	if !existe(t, tx, id) {
		t.Fatal("una cuenta recién registrada no debería tocarse")
	}
}

func TestExpireSinConfirmar_NoTocaCuentasConfirmadas(t *testing.T) {
	tx := testdb.New(t)
	u := db.Usuario{
		Nombre: "Test", Email: uuid.NewString() + "@example.com", PasswordHash: "x", Rol: "cliente",
		EmailConfirmado: true, CreatedAt: time.Now().Add(-365 * 24 * time.Hour), // vieja, no importa
	}
	if err := tx.Create(&u).Error; err != nil {
		t.Fatalf("no se pudo crear el usuario de prueba: %v", err)
	}

	n, err := ExpireSinConfirmar(context.Background(), tx)
	if err != nil {
		t.Fatalf("ExpireSinConfirmar devolvió error: %v", err)
	}
	if n != 0 {
		t.Fatalf("RowsAffected = %d, esperaba 0 — nunca debería tocar cuentas confirmadas", n)
	}
	if !existe(t, tx, u.ID) {
		t.Fatal("una cuenta confirmada nunca debería borrarse, sin importar su antigüedad")
	}
}

// Caso defensivo: CodigoConfirmacion/CodigoExpiracion nil (no debería
// pasar en la práctica, register() siempre los setea) no debería
// reventar el WHERE ni borrar de más.
func TestExpireSinConfirmar_NoTocaCuentasSinCodigoTodavia(t *testing.T) {
	tx := testdb.New(t)
	u := db.Usuario{
		Nombre: "Test", Email: uuid.NewString() + "@example.com", PasswordHash: "x", Rol: "cliente",
		EmailConfirmado: false,
	}
	if err := tx.Create(&u).Error; err != nil {
		t.Fatalf("no se pudo crear el usuario de prueba: %v", err)
	}

	n, err := ExpireSinConfirmar(context.Background(), tx)
	if err != nil {
		t.Fatalf("ExpireSinConfirmar devolvió error: %v", err)
	}
	if n != 0 {
		t.Fatalf("RowsAffected = %d, esperaba 0", n)
	}
	if !existe(t, tx, u.ID) {
		t.Fatal("una cuenta sin código todavía no debería borrarse")
	}
}

func TestExpireSinConfirmar_CuentaVariasEnUnaSolaPasada(t *testing.T) {
	tx := testdb.New(t)
	crearSinConfirmar(t, tx, GraciaTrasVencimiento+time.Hour)
	crearSinConfirmar(t, tx, GraciaTrasVencimiento+24*time.Hour)
	crearSinConfirmar(t, tx, GraciaTrasVencimiento-time.Hour) // esta no vence todavía

	n, err := ExpireSinConfirmar(context.Background(), tx)
	if err != nil {
		t.Fatalf("ExpireSinConfirmar devolvió error: %v", err)
	}
	if n != 2 {
		t.Fatalf("RowsAffected = %d, esperaba 2 (solo las 2 vencidas)", n)
	}
}

// RunExpirer corre en su propia goroutine con su propio ticker — usa
// testdb.Shared (conexión real, comprometida) en vez de testdb.New, mismo
// motivo que internal/reservas.
func TestRunExpirer_BorraEnCadaTickHastaQueElContextoSeCancela(t *testing.T) {
	shared := testdb.Shared(t)
	id := crearSinConfirmar(t, shared, GraciaTrasVencimiento+time.Hour)
	t.Cleanup(func() {
		shared.Exec("DELETE FROM usuarios WHERE id = ?", id) // por si el test falla antes de que RunExpirer la borre
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
			t.Fatal("RunExpirer no borró la cuenta vencida dentro del tiempo esperado")
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
