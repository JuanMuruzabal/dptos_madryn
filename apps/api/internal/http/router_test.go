package http

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"turismo-marcuzzi/api/internal/email"
	"turismo-marcuzzi/api/internal/storage"
	"turismo-marcuzzi/api/internal/testdb"
)

// A diferencia del resto de la suite (que llama a los handlers
// directamente), estos tests arman el router real completo — es la única
// forma de ejercitar NewRouter/healthHandler en sí, y de paso confirma que
// el wiring de middleware (requireAuth en las rutas protegidas, CORS, etc.)
// funciona de punta a punta, no solo cada pieza por separado.
func newTestRouter(t *testing.T) http.Handler {
	t.Helper()
	tx := testdb.New(t)
	store, err := storage.NewLocalStorage(t.TempDir(), "http://localhost:8080/uploads")
	if err != nil {
		t.Fatalf("no se pudo crear el storage de prueba: %v", err)
	}
	return NewRouter(tx, testSecret, store, t.TempDir(), email.LogSender{}, []string{"http://localhost:3000"})
}

func TestNewRouter_HealthCheckConDB(t *testing.T) {
	router := newTestRouter(t)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/health", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	var resp map[string]string
	mustUnmarshal(t, rec.Body.Bytes(), &resp)
	if resp["db"] != "ok" {
		t.Fatalf(`db = %q, esperaba "ok"`, resp["db"])
	}
}

func TestNewRouter_HealthCheckSinDB(t *testing.T) {
	store, err := storage.NewLocalStorage(t.TempDir(), "http://localhost:8080/uploads")
	if err != nil {
		t.Fatalf("no se pudo crear el storage de prueba: %v", err)
	}
	router := NewRouter(nil, testSecret, store, t.TempDir(), email.LogSender{}, []string{"http://localhost:3000"})

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/health", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusOK)
	}
	var resp map[string]string
	mustUnmarshal(t, rec.Body.Bytes(), &resp)
	if resp["db"] != "not_configured" {
		t.Fatalf(`db = %q, esperaba "not_configured"`, resp["db"])
	}
}

func TestNewRouter_RutaProtegidaSinTokenDaUnauthorized(t *testing.T) {
	router := newTestRouter(t)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/me", nil))

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, esperaba %d — el middleware requireAuth debería cortar esto antes de llegar al handler", rec.Code, http.StatusUnauthorized)
	}
}

func TestNewRouter_RutaPublicaFunciona(t *testing.T) {
	router := newTestRouter(t)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/alojamientos", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, esperaba %d — /alojamientos es pública", rec.Code, http.StatusOK)
	}
}

func TestNewRouter_SirveArchivosDeUploads(t *testing.T) {
	uploadsDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(uploadsDir, "test.txt"), []byte("contenido de prueba"), 0o644); err != nil {
		t.Fatalf("no se pudo preparar el archivo de prueba: %v", err)
	}
	store, err := storage.NewLocalStorage(t.TempDir(), "http://localhost:8080/uploads")
	if err != nil {
		t.Fatalf("no se pudo crear el storage de prueba: %v", err)
	}
	router := NewRouter(nil, testSecret, store, uploadsDir, email.LogSender{}, []string{"http://localhost:3000"})

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/uploads/test.txt", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusOK)
	}
	if rec.Body.String() != "contenido de prueba" {
		t.Fatalf("contenido servido = %q, esperaba %q", rec.Body.String(), "contenido de prueba")
	}
}
