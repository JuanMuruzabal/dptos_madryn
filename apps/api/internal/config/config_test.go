package config

import "testing"

// No usan t.Parallel() a propósito: mutan variables de entorno globales
// del proceso (t.Setenv ya evita que corran en paralelo entre sí, pero
// tampoco deberían solaparse con otro test que dependa del entorno).

func TestLoad_DefaultsSinVariablesDeEntorno(t *testing.T) {
	cfg := Load()

	if cfg.Port != "8080" {
		t.Errorf("Port = %q, esperaba %q", cfg.Port, "8080")
	}
	if cfg.DBUrl != "postgres://turismo:turismo@localhost:5432/turismo_marcuzzi?sslmode=disable" {
		t.Errorf("DBUrl inesperado: %q", cfg.DBUrl)
	}
	if cfg.JWTSecret != "dev-secret-cambiar-en-produccion" {
		t.Errorf("JWTSecret inesperado: %q", cfg.JWTSecret)
	}
	if cfg.Env != "development" {
		t.Errorf("Env = %q, esperaba %q", cfg.Env, "development")
	}
	if cfg.UploadsDir != "./uploads" {
		t.Errorf("UploadsDir = %q, esperaba %q", cfg.UploadsDir, "./uploads")
	}
	// UploadsBaseURL depende de Port, así que su default también debe
	// reflejar el default de Port, no un puerto hardcodeado aparte.
	if cfg.UploadsBaseURL != "http://localhost:8080/uploads" {
		t.Errorf("UploadsBaseURL = %q, esperaba %q", cfg.UploadsBaseURL, "http://localhost:8080/uploads")
	}
}

func TestLoad_VariablesDeEntornoPisanLosDefaults(t *testing.T) {
	t.Setenv("PORT", "9090")
	t.Setenv("DATABASE_URL", "postgres://otra/base")
	t.Setenv("JWT_SECRET", "otro-secreto")
	t.Setenv("APP_ENV", "production")
	t.Setenv("UPLOADS_DIR", "/data/uploads")
	t.Setenv("UPLOADS_BASE_URL", "https://cdn.example.com/uploads")

	cfg := Load()

	if cfg.Port != "9090" {
		t.Errorf("Port = %q, esperaba %q", cfg.Port, "9090")
	}
	if cfg.DBUrl != "postgres://otra/base" {
		t.Errorf("DBUrl = %q, esperaba el valor de DATABASE_URL", cfg.DBUrl)
	}
	if cfg.JWTSecret != "otro-secreto" {
		t.Errorf("JWTSecret = %q, esperaba el valor de JWT_SECRET", cfg.JWTSecret)
	}
	if cfg.Env != "production" {
		t.Errorf("Env = %q, esperaba %q", cfg.Env, "production")
	}
	if cfg.UploadsDir != "/data/uploads" {
		t.Errorf("UploadsDir = %q, esperaba el valor de UPLOADS_DIR", cfg.UploadsDir)
	}
	if cfg.UploadsBaseURL != "https://cdn.example.com/uploads" {
		t.Errorf("UploadsBaseURL = %q, esperaba el valor de UPLOADS_BASE_URL, no uno derivado de PORT", cfg.UploadsBaseURL)
	}
}

// getEnv trata una variable seteada pero vacía como "no seteada" — un
// `PORT=` vacío en el entorno de deploy no debería tumbar el default.
func TestGetEnv_VariableVaciaUsaElDefault(t *testing.T) {
	t.Setenv("PORT", "")

	cfg := Load()
	if cfg.Port != "8080" {
		t.Errorf("Port = %q, esperaba el default %q porque PORT está vacío", cfg.Port, "8080")
	}
}
