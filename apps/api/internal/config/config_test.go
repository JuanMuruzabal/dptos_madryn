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
	if cfg.R2Bucket != "" || cfg.R2AccountID != "" || cfg.R2AccessKeyID != "" || cfg.R2SecretAccessKey != "" || cfg.R2PublicURL != "" {
		t.Errorf("los campos R2 deberían estar vacíos por defecto (sigue en LocalStorage), cfg = %+v", cfg)
	}
	if len(cfg.CORSAllowedOrigins) != 1 || cfg.CORSAllowedOrigins[0] != "http://localhost:3000" {
		t.Errorf("CORSAllowedOrigins = %v, esperaba [\"http://localhost:3000\"]", cfg.CORSAllowedOrigins)
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

func TestLoad_VariablesDeR2PisanLosDefaults(t *testing.T) {
	t.Setenv("R2_ACCOUNT_ID", "acc123")
	t.Setenv("R2_ACCESS_KEY_ID", "key123")
	t.Setenv("R2_SECRET_ACCESS_KEY", "secret123")
	t.Setenv("R2_BUCKET", "turismo-marcuzzi-uploads")
	t.Setenv("R2_PUBLIC_URL", "https://pub-xxxx.r2.dev")

	cfg := Load()

	if cfg.R2AccountID != "acc123" {
		t.Errorf("R2AccountID = %q, esperaba %q", cfg.R2AccountID, "acc123")
	}
	if cfg.R2AccessKeyID != "key123" {
		t.Errorf("R2AccessKeyID = %q, esperaba %q", cfg.R2AccessKeyID, "key123")
	}
	if cfg.R2SecretAccessKey != "secret123" {
		t.Errorf("R2SecretAccessKey = %q, esperaba %q", cfg.R2SecretAccessKey, "secret123")
	}
	if cfg.R2Bucket != "turismo-marcuzzi-uploads" {
		t.Errorf("R2Bucket = %q, esperaba %q", cfg.R2Bucket, "turismo-marcuzzi-uploads")
	}
	if cfg.R2PublicURL != "https://pub-xxxx.r2.dev" {
		t.Errorf("R2PublicURL = %q, esperaba %q", cfg.R2PublicURL, "https://pub-xxxx.r2.dev")
	}
}

func TestLoad_CORSAllowedOriginsConUnValor(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://turismomarcuzzi.com.ar")

	cfg := Load()

	if len(cfg.CORSAllowedOrigins) != 1 || cfg.CORSAllowedOrigins[0] != "https://turismomarcuzzi.com.ar" {
		t.Errorf("CORSAllowedOrigins = %v, esperaba [\"https://turismomarcuzzi.com.ar\"]", cfg.CORSAllowedOrigins)
	}
}

func TestLoad_CORSAllowedOriginsConVariosValoresSeparadosPorComa(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://a.com, https://b.com,https://c.com")

	cfg := Load()

	want := []string{"https://a.com", "https://b.com", "https://c.com"}
	if len(cfg.CORSAllowedOrigins) != len(want) {
		t.Fatalf("CORSAllowedOrigins = %v, esperaba %v", cfg.CORSAllowedOrigins, want)
	}
	for i, w := range want {
		if cfg.CORSAllowedOrigins[i] != w {
			t.Errorf("CORSAllowedOrigins[%d] = %q, esperaba %q", i, cfg.CORSAllowedOrigins[i], w)
		}
	}
}

func TestLoad_CORSAllowedOriginsVacioUsaElDefault(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "")

	cfg := Load()

	if len(cfg.CORSAllowedOrigins) != 1 || cfg.CORSAllowedOrigins[0] != "http://localhost:3000" {
		t.Errorf("CORSAllowedOrigins = %v, esperaba el default", cfg.CORSAllowedOrigins)
	}
}

// Un valor con solo comas/espacios ("  , ,  ") no debería producir una
// lista vacía silenciosa (CORS bloquearía TODO origen sin decir por qué)
// — cae al default en vez de eso.
func TestLoad_CORSAllowedOriginsSoloComasYEspaciosUsaElDefault(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "  , , ")

	cfg := Load()

	if len(cfg.CORSAllowedOrigins) != 1 || cfg.CORSAllowedOrigins[0] != "http://localhost:3000" {
		t.Errorf("CORSAllowedOrigins = %v, esperaba el default", cfg.CORSAllowedOrigins)
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
