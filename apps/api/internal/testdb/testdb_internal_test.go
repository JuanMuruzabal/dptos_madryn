package testdb

import "testing"

// Test interno (package testdb, no testdb_test) para poder llamar la
// función no exportada directamente — es la red de seguridad de TR-038/R12
// ("nunca corras los tests contra la base de desarrollo/producción") y
// merece un test explícito de su propio rechazo, no solo confiar en que el
// resto de la suite siempre use un DSN que termine en "_test".
func TestRequireTestDatabaseName(t *testing.T) {
	casos := []struct {
		nombre      string
		dsn         string
		quiereError bool
	}{
		{"termina en _test", "postgres://u:p@localhost:5432/turismo_marcuzzi_test?sslmode=disable", false},
		{"es la base de desarrollo real", "postgres://u:p@localhost:5432/turismo_marcuzzi?sslmode=disable", true},
		{"es la base postgres de mantenimiento", "postgres://u:p@localhost:5432/postgres?sslmode=disable", true},
		{"DSN inválida", "esto-no-es-una-url-valida://%%%", true},
	}

	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			_, err := requireTestDatabaseName(c.dsn)
			if c.quiereError && err == nil {
				t.Fatal("esperaba que se rechazara este DSN")
			}
			if !c.quiereError && err != nil {
				t.Fatalf("no esperaba error, dio: %v", err)
			}
		})
	}
}
