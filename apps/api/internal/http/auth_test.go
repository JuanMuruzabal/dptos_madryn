package http

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"turismo-marcuzzi/api/internal/db"
	"turismo-marcuzzi/api/internal/testdb"
)

// fakeCaptcha — turnstile.Verifier de mentira para tests, nunca pega a la
// red real (mismo criterio que el resto de la suite con dependencias
// externas, ver internal/email.LogSender).
type fakeCaptcha struct {
	ok  bool
	err error
}

func (f fakeCaptcha) Verify(token, remoteIP string) (bool, error) {
	return f.ok, f.err
}

func jsonBody(t *testing.T, v any) *bytes.Buffer {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("no se pudo serializar el body de prueba: %v", err)
	}
	return bytes.NewBuffer(b)
}

func TestRegister_CreaUsuarioYDevuelveToken(t *testing.T) {
	h := &authHandler{db: testdb.New(t), jwtSecret: testSecret}

	body := jsonBody(t, registerRequest{Nombre: "Ana Test", Email: "ana@example.com", Password: "password123"})
	req := httptest.NewRequest(http.MethodPost, "/auth/register", body)
	rec := httptest.NewRecorder()

	h.register(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusCreated, rec.Body.String())
	}
	var resp authResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("no se pudo parsear la respuesta: %v", err)
	}
	if resp.Usuario.Email != "ana@example.com" {
		t.Errorf("Email = %q, esperaba %q", resp.Usuario.Email, "ana@example.com")
	}
	if resp.Usuario.Rol != "cliente" {
		t.Errorf("Rol = %q, esperaba %q — el registro nunca debería poder crear un admin", resp.Usuario.Rol, "cliente")
	}
	if resp.Token == "" {
		t.Error("esperaba un token no vacío")
	}
}

func TestRegister_NormalizaElEmail(t *testing.T) {
	h := &authHandler{db: testdb.New(t), jwtSecret: testSecret}

	body := jsonBody(t, registerRequest{Nombre: "Test", Email: "  MAYUSCULA@Example.COM  ", Password: "password123"})
	req := httptest.NewRequest(http.MethodPost, "/auth/register", body)
	rec := httptest.NewRecorder()

	h.register(rec, req)

	var resp authResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("no se pudo parsear la respuesta: %v", err)
	}
	if resp.Usuario.Email != "mayuscula@example.com" {
		t.Errorf("Email = %q, esperaba que quedara en minúscula y sin espacios", resp.Usuario.Email)
	}
}

func TestRegister_RechazaEmailDuplicado(t *testing.T) {
	h := &authHandler{db: testdb.New(t), jwtSecret: testSecret}

	primero := jsonBody(t, registerRequest{Nombre: "Uno", Email: "duplicado@example.com", Password: "password123"})
	h.register(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/auth/register", primero))

	segundo := jsonBody(t, registerRequest{Nombre: "Dos", Email: "duplicado@example.com", Password: "otraPassword123"})
	rec := httptest.NewRecorder()
	h.register(rec, httptest.NewRequest(http.MethodPost, "/auth/register", segundo))

	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusConflict)
	}
}

func TestRegister_ValidaCamposRequeridos(t *testing.T) {
	casos := []struct {
		nombre string
		req    registerRequest
	}{
		{"nombre vacío", registerRequest{Nombre: "  ", Email: "valido@example.com", Password: "password123"}},
		{"email inválido", registerRequest{Nombre: "Test", Email: "no-es-un-email", Password: "password123"}},
		{"password corta", registerRequest{Nombre: "Test", Email: "valido@example.com", Password: "corta"}},
	}

	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			h := &authHandler{db: testdb.New(t), jwtSecret: testSecret}
			rec := httptest.NewRecorder()
			h.register(rec, httptest.NewRequest(http.MethodPost, "/auth/register", jsonBody(t, c.req)))

			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusBadRequest, rec.Body.String())
			}
		})
	}
}

func TestRegister_CuerpoInvalidoDaBadRequest(t *testing.T) {
	h := &authHandler{db: testdb.New(t), jwtSecret: testSecret}
	rec := httptest.NewRecorder()
	h.register(rec, httptest.NewRequest(http.MethodPost, "/auth/register", bytes.NewBufferString("esto no es json")))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

// --- CAPTCHA (TR-047) ---

func TestRegister_SinCaptchaConfiguradoNoLoExige(t *testing.T) {
	// h.captcha nil (no seteado) — mismo caso que TODOS los demás tests de
	// este archivo, que no mandan CaptchaToken: siguen pasando porque el
	// registro real (producción) siempre lo trae seteado desde main.go,
	// esto es solo para no exigirlo en tests que no lo ejercitan a propósito.
	h := &authHandler{db: testdb.New(t), jwtSecret: testSecret}
	body := jsonBody(t, registerRequest{Nombre: "Test", Email: "sincaptcha@example.com", Password: "password123"})
	rec := httptest.NewRecorder()
	h.register(rec, httptest.NewRequest(http.MethodPost, "/auth/register", body))

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusCreated, rec.Body.String())
	}
}

func TestRegister_ConCaptchaConfiguradoPeroSinTokenDaBadRequest(t *testing.T) {
	h := &authHandler{db: testdb.New(t), jwtSecret: testSecret, captcha: fakeCaptcha{ok: true}}
	body := jsonBody(t, registerRequest{Nombre: "Test", Email: "sintoken@example.com", Password: "password123"})
	rec := httptest.NewRecorder()
	h.register(rec, httptest.NewRequest(http.MethodPost, "/auth/register", body))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusBadRequest, rec.Body.String())
	}
}

func TestRegister_CaptchaRechazadoDaBadRequestYNoCreaElUsuario(t *testing.T) {
	tx := testdb.New(t)
	h := &authHandler{db: tx, jwtSecret: testSecret, captcha: fakeCaptcha{ok: false}}
	body := jsonBody(t, registerRequest{
		Nombre: "Test", Email: "rechazado@example.com", Password: "password123", CaptchaToken: "token-cualquiera",
	})
	rec := httptest.NewRecorder()
	h.register(rec, httptest.NewRequest(http.MethodPost, "/auth/register", body))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusBadRequest, rec.Body.String())
	}

	var count int64
	tx.Model(&db.Usuario{}).Where("email = ?", "rechazado@example.com").Count(&count)
	if count != 0 {
		t.Error("no debería haberse creado ningún usuario con un captcha rechazado")
	}
}

func TestRegister_ErrorVerificandoCaptchaDaInternalServerError(t *testing.T) {
	h := &authHandler{db: testdb.New(t), jwtSecret: testSecret, captcha: fakeCaptcha{err: errors.New("cloudflare caído")}}
	body := jsonBody(t, registerRequest{
		Nombre: "Test", Email: "errorcaptcha@example.com", Password: "password123", CaptchaToken: "token-cualquiera",
	})
	rec := httptest.NewRecorder()
	h.register(rec, httptest.NewRequest(http.MethodPost, "/auth/register", body))

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusInternalServerError, rec.Body.String())
	}
}

func TestRegister_CaptchaAprobadoCreaElUsuario(t *testing.T) {
	h := &authHandler{db: testdb.New(t), jwtSecret: testSecret, captcha: fakeCaptcha{ok: true}}
	body := jsonBody(t, registerRequest{
		Nombre: "Test", Email: "aprobado@example.com", Password: "password123", CaptchaToken: "token-valido",
	})
	rec := httptest.NewRecorder()
	h.register(rec, httptest.NewRequest(http.MethodPost, "/auth/register", body))

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusCreated, rec.Body.String())
	}
}

func TestLogin_ConCredencialesCorrectas(t *testing.T) {
	h := &authHandler{db: testdb.New(t), jwtSecret: testSecret}

	registro := jsonBody(t, registerRequest{Nombre: "Login Test", Email: "login@example.com", Password: "password123"})
	h.register(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/auth/register", registro))

	login := jsonBody(t, loginRequest{Email: "LOGIN@example.com", Password: "password123"})
	rec := httptest.NewRecorder()
	h.login(rec, httptest.NewRequest(http.MethodPost, "/auth/login", login))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusOK, rec.Body.String())
	}
}

func TestLogin_PasswordIncorrectaDaUnauthorized(t *testing.T) {
	h := &authHandler{db: testdb.New(t), jwtSecret: testSecret}

	registro := jsonBody(t, registerRequest{Nombre: "Test", Email: "wrongpass@example.com", Password: "password123"})
	h.register(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/auth/register", registro))

	login := jsonBody(t, loginRequest{Email: "wrongpass@example.com", Password: "otra-password"})
	rec := httptest.NewRecorder()
	h.login(rec, httptest.NewRequest(http.MethodPost, "/auth/login", login))

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusUnauthorized)
	}
}

// No debe revelar si el email existe o no — mismo status/mensaje que
// password incorrecta (ver comentario en auth.go).
func TestLogin_EmailInexistenteDaUnauthorized(t *testing.T) {
	h := &authHandler{db: testdb.New(t), jwtSecret: testSecret}

	login := jsonBody(t, loginRequest{Email: "no-existe@example.com", Password: "cualquier-cosa"})
	rec := httptest.NewRecorder()
	h.login(rec, httptest.NewRequest(http.MethodPost, "/auth/login", login))

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestLogin_CuerpoInvalidoDaBadRequest(t *testing.T) {
	h := &authHandler{db: testdb.New(t), jwtSecret: testSecret}
	rec := httptest.NewRecorder()
	h.login(rec, httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewBufferString("{invalido")))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

func TestMeHandler_DevuelveElUsuarioAutenticado(t *testing.T) {
	tx := testdb.New(t)
	h := &authHandler{db: tx, jwtSecret: testSecret}

	registro := jsonBody(t, registerRequest{Nombre: "Me Test", Email: "me@example.com", Password: "password123"})
	recRegistro := httptest.NewRecorder()
	h.register(recRegistro, httptest.NewRequest(http.MethodPost, "/auth/register", registro))

	var registrado authResponse
	if err := json.Unmarshal(recRegistro.Body.Bytes(), &registrado); err != nil {
		t.Fatalf("no se pudo parsear la respuesta del registro: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/me", nil)
	req.Header.Set("Authorization", "Bearer "+registrado.Token)
	rec := httptest.NewRecorder()

	requireAuth(testSecret)(meHandler(tx)).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	var usuario usuarioResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &usuario); err != nil {
		t.Fatalf("no se pudo parsear la respuesta: %v", err)
	}
	if usuario.Email != "me@example.com" {
		t.Errorf("Email = %q, esperaba %q", usuario.Email, "me@example.com")
	}
}

// Regresión de la incidencia del 2026-08-13: un token válido pero de un
// usuario que ya no existe en la base (p. ej. borrado) tiene que dar 404,
// nunca comportarse como si estuviera autenticado con datos vacíos.
func TestMeHandler_UsuarioBorradoDaNotFound(t *testing.T) {
	tx := testdb.New(t)
	h := &authHandler{db: tx, jwtSecret: testSecret}

	registro := jsonBody(t, registerRequest{Nombre: "Efímero", Email: "efimero@example.com", Password: "password123"})
	recRegistro := httptest.NewRecorder()
	h.register(recRegistro, httptest.NewRequest(http.MethodPost, "/auth/register", registro))

	var registrado authResponse
	if err := json.Unmarshal(recRegistro.Body.Bytes(), &registrado); err != nil {
		t.Fatalf("no se pudo parsear la respuesta del registro: %v", err)
	}

	if err := tx.Exec("DELETE FROM usuarios WHERE id = ?", registrado.Usuario.ID).Error; err != nil {
		t.Fatalf("no se pudo borrar el usuario de prueba: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/me", nil)
	req.Header.Set("Authorization", "Bearer "+registrado.Token)
	rec := httptest.NewRecorder()

	requireAuth(testSecret)(meHandler(tx)).ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusNotFound)
	}
}

func TestMeHandler_SinClaimsDaUnauthorized(t *testing.T) {
	tx := testdb.New(t)
	req := httptest.NewRequest(http.MethodGet, "/me", nil).WithContext(context.Background())
	rec := httptest.NewRecorder()

	meHandler(tx)(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusUnauthorized)
	}
}
