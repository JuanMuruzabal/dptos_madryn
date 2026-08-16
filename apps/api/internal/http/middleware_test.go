package http

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"

	"turismo-marcuzzi/api/internal/auth"
)

const testSecret = "secreto-de-test-middleware"

func okHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
}

func tokenPara(t *testing.T, rol string) string {
	t.Helper()
	token, err := auth.GenerateToken(testSecret, uuid.New(), rol)
	if err != nil {
		t.Fatalf("no se pudo generar el token de prueba: %v", err)
	}
	return token
}

func TestRequireAuth_SinHeaderDaUnauthorized(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()

	requireAuth(testSecret)(okHandler()).ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestRequireAuth_HeaderSinBearerDaUnauthorized(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "esto-no-tiene-el-prefijo-bearer")
	rec := httptest.NewRecorder()

	requireAuth(testSecret)(okHandler()).ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestRequireAuth_TokenInvalidoDaUnauthorized(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer esto-no-es-un-jwt")
	rec := httptest.NewRecorder()

	requireAuth(testSecret)(okHandler()).ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestRequireAuth_TokenValidoDejaPasarYPoneClaimsEnElContexto(t *testing.T) {
	var claimsVistos *auth.Claims
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claimsVistos, _ = claimsFromContext(r)
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tokenPara(t, "cliente"))
	rec := httptest.NewRecorder()

	requireAuth(testSecret)(next).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusOK)
	}
	if claimsVistos == nil {
		t.Fatal("el siguiente handler debería poder leer los claims del contexto")
	}
	if claimsVistos.Rol != "cliente" {
		t.Fatalf("Rol en el contexto = %q, esperaba %q", claimsVistos.Rol, "cliente")
	}
}

func TestRequireRole_SinClaimsEnElContextoDaUnauthorized(t *testing.T) {
	// requireRole solo, sin requireAuth por delante — no hay claims.
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()

	requireRole("administrador")(okHandler()).ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestRequireRole_RolIncorrectoDaForbidden(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tokenPara(t, "cliente"))
	rec := httptest.NewRecorder()

	chain := requireAuth(testSecret)(requireRole("administrador")(okHandler()))
	chain.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusForbidden)
	}
}

func TestRequireRole_RolCorrectoDejaPasar(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tokenPara(t, "administrador"))
	rec := httptest.NewRecorder()

	chain := requireAuth(testSecret)(requireRole("administrador")(okHandler()))
	chain.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusOK)
	}
}

func TestIsAdminCaller(t *testing.T) {
	casos := []struct {
		nombre   string
		header   string
		esperado bool
	}{
		{"sin header", "", false},
		{"header sin bearer", "esto-no-tiene-el-prefijo", false},
		{"token inválido", "Bearer esto-no-es-un-jwt", false},
		{"token válido pero cliente", "Bearer " + tokenPara(t, "cliente"), false},
		{"token válido de administrador", "Bearer " + tokenPara(t, "administrador"), true},
	}

	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			if c.header != "" {
				req.Header.Set("Authorization", c.header)
			}

			got := isAdminCaller(req, testSecret)
			if got != c.esperado {
				t.Fatalf("isAdminCaller() = %v, esperaba %v", got, c.esperado)
			}
		})
	}
}
