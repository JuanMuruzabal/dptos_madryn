package testdb_test

import (
	"testing"

	"turismo-marcuzzi/api/internal/db"
	"turismo-marcuzzi/api/internal/testdb"
)

// Estos dos tests son el criterio de aceptación de T12.1: corren en
// paralelo (t.Parallel) usando cada uno su propia transacción, y el
// segundo verifica que NO ve lo que insertó el primero — si el rollback
// de New() no funcionara, o las transacciones compartieran conexión,
// este test lo detectaría.

func TestNew_aislaTransaccionesEntreTests(t *testing.T) {
	t.Parallel()
	tx := testdb.New(t)

	usuario := db.Usuario{
		Nombre:       "Test A",
		Email:        "testdb-aislamiento-a@example.com",
		PasswordHash: "x",
		Rol:          "cliente",
	}
	if err := tx.Create(&usuario).Error; err != nil {
		t.Fatalf("no se pudo crear el usuario de prueba: %v", err)
	}

	var count int64
	tx.Model(&db.Usuario{}).Where("email = ?", usuario.Email).Count(&count)
	if count != 1 {
		t.Fatalf("esperaba ver el usuario recién creado dentro de la misma transacción, count=%d", count)
	}
}

func TestNew_noVeDatosDeOtroTest(t *testing.T) {
	t.Parallel()
	tx := testdb.New(t)

	var count int64
	tx.Model(&db.Usuario{}).Where("email = ?", "testdb-aislamiento-a@example.com").Count(&count)
	if count != 0 {
		t.Fatalf("no debería ver el usuario del otro test — la transacción no está aislada (count=%d)", count)
	}
}

// Correr la suite completa dos veces seguidas debe dar el mismo
// resultado (nada de estado que se acumule entre corridas) — este test
// en particular reutiliza el mismo email en cada corrida a propósito.
func TestNew_mismoResultadoEntreCorridas(t *testing.T) {
	tx := testdb.New(t)

	usuario := db.Usuario{
		Nombre:       "Test Repetible",
		Email:        "testdb-repetible@example.com",
		PasswordHash: "x",
		Rol:          "cliente",
	}
	if err := tx.Create(&usuario).Error; err != nil {
		t.Fatalf("no se pudo crear el usuario en esta corrida: %v", err)
	}
}
