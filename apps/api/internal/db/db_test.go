package db_test

import (
	"os"
	"strings"
	"testing"

	"turismo-marcuzzi/api/internal/db"
)

// No usa internal/testdb a propósito: testdb importa este mismo paquete
// (db), así que hacerlo al revés sería un ciclo de imports. Se duplica acá
// la lógica mínima de "a qué base de test conectarse", con la misma red de
// seguridad (el nombre tiene que terminar en "_test").
func testDSN(t *testing.T) string {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://turismo:turismo@localhost:5432/turismo_marcuzzi_test?sslmode=disable"
	}
	if !strings.Contains(dsn, "_test") {
		t.Fatalf("TEST_DATABASE_URL (%q) tiene que apuntar a una base que termine en \"_test\"", dsn)
	}
	return dsn
}

func TestConnect_Exitoso(t *testing.T) {
	gdb, err := db.Connect(testDSN(t))
	if err != nil {
		t.Fatalf("Connect devolvió error: %v", err)
	}
	sqlDB, err := gdb.DB()
	if err != nil {
		t.Fatalf("no se pudo obtener *sql.DB desde gorm: %v", err)
	}
	if err := sqlDB.Ping(); err != nil {
		t.Fatalf("ping a la base falló: %v", err)
	}
}

func TestConnect_HostInexistenteDaError(t *testing.T) {
	_, err := db.Connect("postgres://turismo:turismo@host-que-no-existe-de-verdad.invalid:5432/x_test?sslmode=disable&connect_timeout=1")
	if err == nil {
		t.Fatal("Connect con un host inexistente debería devolver error")
	}
}

// RunMigrations tiene que poder correrse muchas veces sin romper nada —
// es justamente el comportamiento del que depende todo el resto de la
// suite (internal/testdb la llama una vez por proceso de test, y varios
// procesos de test de paquetes distintos corren en paralelo).
func TestRunMigrations_EsIdempotente(t *testing.T) {
	gdb, err := db.Connect(testDSN(t))
	if err != nil {
		t.Fatalf("Connect devolvió error: %v", err)
	}

	if err := db.RunMigrations(gdb); err != nil {
		t.Fatalf("primera corrida de RunMigrations devolvió error: %v", err)
	}
	if err := db.RunMigrations(gdb); err != nil {
		t.Fatalf("segunda corrida de RunMigrations (debería ser un no-op) devolvió error: %v", err)
	}
}
