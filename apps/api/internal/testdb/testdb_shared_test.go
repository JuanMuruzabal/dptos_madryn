package testdb_test

import (
	"testing"

	"turismo-marcuzzi/api/internal/testdb"
)

// Shared se usa desde otros paquetes (T12.10/T12.12, tests de concurrencia
// real) — este test la ejercita directo dentro del propio paquete testdb
// para que su coverage no dependa de correr esos paquetes primero.
func TestShared_DevuelveUnaConexionUtilizable(t *testing.T) {
	shared := testdb.Shared(t)

	sqlDB, err := shared.DB()
	if err != nil {
		t.Fatalf("no se pudo obtener *sql.DB: %v", err)
	}
	if err := sqlDB.Ping(); err != nil {
		t.Fatalf("ping falló: %v", err)
	}
}

func TestShared_DevuelveLaMismaConexionEntreLlamados(t *testing.T) {
	a := testdb.Shared(t)
	b := testdb.Shared(t)
	if a != b {
		t.Fatal("Shared debería devolver siempre la misma conexión compartida (mismo singleton que New)")
	}
}
