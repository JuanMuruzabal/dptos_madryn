package http

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"turismo-marcuzzi/api/internal/clock"
	"turismo-marcuzzi/api/internal/db"
	"turismo-marcuzzi/api/internal/googleauth"
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

// fakeGoogleExchanger — googleauth.Exchanger de mentira, nunca pega a
// Google de verdad (mismo criterio que fakeCaptcha).
type fakeGoogleExchanger struct {
	user googleauth.GoogleUser
	err  error
}

func (f fakeGoogleExchanger) Exchange(ctx context.Context, code string) (googleauth.GoogleUser, error) {
	return f.user, f.err
}

// fakeEmailSender — email.Sender de mentira que solo guarda lo que le
// mandaron, para los pocos tests que necesitan confirmar que SE INTENTÓ
// mandar un email (la mayoría de los tests de este archivo dejan h.email
// nil, ver el guard en auth.go).
type fakeEmailSender struct {
	enviados []emailEnviado
}

type emailEnviado struct {
	to, subject, body string
}

func (f *fakeEmailSender) Send(_ context.Context, to, subject, body string) error {
	f.enviados = append(f.enviados, emailEnviado{to: to, subject: subject, body: body})
	return nil
}

func jsonBody(t *testing.T, v any) *bytes.Buffer {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("no se pudo serializar el body de prueba: %v", err)
	}
	return bytes.NewBuffer(b)
}

// validRegisterRequest arma un registerRequest "por lo demás válido" —
// confirmarEmail/confirmarPassword ya coinciden — para que cada test solo
// tenga que pisar el campo puntual que quiere probar (2026-08-18, Prompt 2:
// confirmarEmail/confirmarPassword pasan a ser obligatorios y validados
// acá, así que cada literal viejo de registerRequest necesita esto para no
// romper por "los emails no coinciden" antes de llegar a lo que el test
// realmente quiere ejercitar).
func validRegisterRequest(nombre, email, password string) registerRequest {
	return registerRequest{
		Nombre:            nombre,
		Email:             email,
		ConfirmarEmail:    email,
		Password:          password,
		ConfirmarPassword: password,
	}
}

// crearUsuarioConfirmado inserta un Usuario directo en la base (sin pasar
// por register()+confirmar()) con EmailConfirmado=true y una contraseña
// hasheada de verdad — atajo de setup para tests de login/me que no le
// importa ejercitar el flujo de alta en sí, solo necesitan una cuenta ya
// activa.
func crearUsuarioConfirmado(t *testing.T, tx *gorm.DB, nombre, email, password string) db.Usuario {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("no se pudo hashear la contraseña de prueba: %v", err)
	}
	usuario := db.Usuario{
		Nombre:          nombre,
		Email:           email,
		PasswordHash:    string(hash),
		Rol:             "cliente",
		EmailConfirmado: true,
	}
	if err := tx.Create(&usuario).Error; err != nil {
		t.Fatalf("no se pudo crear el usuario de prueba: %v", err)
	}
	return usuario
}

// codigoDe lee el código de confirmación que register()/reenviarCodigo()
// dejaron en la base para ese email — evita depender de capturar el
// email "enviado" (h.email puede ser nil en la mayoría de estos tests).
func codigoDe(t *testing.T, tx *gorm.DB, email string) string {
	t.Helper()
	var usuario db.Usuario
	if err := tx.Where("email = ?", email).First(&usuario).Error; err != nil {
		t.Fatalf("no se pudo leer el usuario de prueba: %v", err)
	}
	if usuario.CodigoConfirmacion == nil {
		t.Fatal("el usuario no tiene un código de confirmación pendiente")
	}
	return *usuario.CodigoConfirmacion
}

func TestRegister_CreaUsuarioPeroSinConfirmar(t *testing.T) {
	tx := testdb.New(t)
	h := &authHandler{db: tx, jwtSecret: testSecret}

	body := jsonBody(t, validRegisterRequest("Ana Test", "ana@example.com", "password123"))
	req := httptest.NewRequest(http.MethodPost, "/auth/register", body)
	rec := httptest.NewRecorder()

	h.register(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusCreated, rec.Body.String())
	}
	var resp registerResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("no se pudo parsear la respuesta: %v", err)
	}
	if resp.Usuario.Email != "ana@example.com" {
		t.Errorf("Email = %q, esperaba %q", resp.Usuario.Email, "ana@example.com")
	}
	if resp.Usuario.Rol != "cliente" {
		t.Errorf("Rol = %q, esperaba %q — el registro nunca debería poder crear un admin", resp.Usuario.Rol, "cliente")
	}
	if !resp.RequiereConfirmacion {
		t.Error("esperaba RequiereConfirmacion = true")
	}

	// Prompt 2: la cuenta queda pendiente de confirmar, con un código de 6
	// dígitos y una expiración seteada — nunca activa/logueable todavía.
	var usuario db.Usuario
	tx.Where("email = ?", "ana@example.com").First(&usuario)
	if usuario.EmailConfirmado {
		t.Error("EmailConfirmado debería ser false recién registrado")
	}
	if usuario.CodigoConfirmacion == nil || len(*usuario.CodigoConfirmacion) != 6 {
		t.Errorf("CodigoConfirmacion = %v, esperaba un código de 6 dígitos", usuario.CodigoConfirmacion)
	}
	if usuario.CodigoExpiracion == nil || !usuario.CodigoExpiracion.After(clock.Now()) {
		t.Errorf("CodigoExpiracion = %v, esperaba una fecha futura", usuario.CodigoExpiracion)
	}
}

func TestRegister_NormalizaElEmail(t *testing.T) {
	tx := testdb.New(t)
	h := &authHandler{db: tx, jwtSecret: testSecret}

	crudo := "  MAYUSCULA@Example.COM  "
	body := jsonBody(t, validRegisterRequest("Test", crudo, "password123"))
	req := httptest.NewRequest(http.MethodPost, "/auth/register", body)
	rec := httptest.NewRecorder()

	h.register(rec, req)

	var resp registerResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("no se pudo parsear la respuesta: %v", err)
	}
	if resp.Usuario.Email != "mayuscula@example.com" {
		t.Errorf("Email = %q, esperaba que quedara en minúscula y sin espacios", resp.Usuario.Email)
	}
}

// Solo rechaza de verdad si la cuenta existente YA está confirmada — si
// no, es el caso de "reintentar registro" (ver test de abajo), no un
// duplicado real.
func TestRegister_RechazaEmailDuplicadoSiLaCuentaYaEstaConfirmada(t *testing.T) {
	tx := testdb.New(t)
	h := &authHandler{db: tx, jwtSecret: testSecret}
	crearUsuarioConfirmado(t, tx, "Uno", "duplicado@example.com", "password123")

	segundo := jsonBody(t, validRegisterRequest("Dos", "duplicado@example.com", "otraPassword123"))
	rec := httptest.NewRecorder()
	h.register(rec, httptest.NewRequest(http.MethodPost, "/auth/register", segundo))

	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusConflict)
	}
}

// Bug real reportado por el cliente (2026-08-18): si el usuario cierra la
// pantalla de confirmación antes de cargar el código y vuelve a intentar
// registrarse, no debería quedar softlockeado — reintentar con el mismo
// email (todavía sin confirmar) actualiza la cuenta y manda un código
// nuevo, en vez de rechazar con "ya existe".
func TestRegister_ReintentoConCuentaSinConfirmarActualizaYMandaCodigoNuevo(t *testing.T) {
	tx := testdb.New(t)
	h := &authHandler{db: tx, jwtSecret: testSecret}

	primero := jsonBody(t, validRegisterRequest("Uno", "reintento@example.com", "password123"))
	h.register(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/auth/register", primero))
	codigoViejo := codigoDe(t, tx, "reintento@example.com")

	segundo := jsonBody(t, validRegisterRequest("Dos", "reintento@example.com", "otraPassword123"))
	rec := httptest.NewRecorder()
	h.register(rec, httptest.NewRequest(http.MethodPost, "/auth/register", segundo))

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, esperaba %d (no debería rechazar, es un reintento) — body: %s", rec.Code, http.StatusCreated, rec.Body.String())
	}
	var resp registerResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("no se pudo parsear la respuesta: %v", err)
	}
	if !resp.RequiereConfirmacion {
		t.Error("esperaba RequiereConfirmacion = true")
	}
	if resp.Usuario.Nombre != "Dos" {
		t.Errorf("Nombre = %q, esperaba que se actualizara al del reintento (%q)", resp.Usuario.Nombre, "Dos")
	}

	// No se duplicó la fila.
	var count int64
	tx.Model(&db.Usuario{}).Where("email = ?", "reintento@example.com").Count(&count)
	if count != 1 {
		t.Fatalf("count = %d, esperaba 1 — el reintento no debería crear una cuenta duplicada", count)
	}

	// El código viejo quedó invalidado; la contraseña del reintento
	// (no la original) es la que ahora sirve para loguear tras confirmar.
	codigoNuevo := codigoDe(t, tx, "reintento@example.com")
	if codigoNuevo == codigoViejo {
		t.Error("esperaba un código distinto del original")
	}

	confirmar := jsonBody(t, confirmarRequest{Email: "reintento@example.com", Codigo: codigoNuevo})
	recConfirmar := httptest.NewRecorder()
	h.confirmar(recConfirmar, httptest.NewRequest(http.MethodPost, "/auth/confirmar", confirmar))
	if recConfirmar.Code != http.StatusOK {
		t.Fatalf("confirmar con el código del reintento: status = %d, esperaba %d", recConfirmar.Code, http.StatusOK)
	}

	login := jsonBody(t, loginRequest{Email: "reintento@example.com", Password: "otraPassword123"})
	recLogin := httptest.NewRecorder()
	h.login(recLogin, httptest.NewRequest(http.MethodPost, "/auth/login", login))
	if recLogin.Code != http.StatusOK {
		t.Errorf("login con la contraseña del reintento: status = %d, esperaba %d", recLogin.Code, http.StatusOK)
	}
}

// El código viejo (del primer intento, antes de reintentar) ya no sirve
// después del reintento — mismo criterio que reenviar-codigo.
func TestRegister_ReintentoInvalidaElCodigoDelIntentoAnterior(t *testing.T) {
	tx := testdb.New(t)
	h := &authHandler{db: tx, jwtSecret: testSecret}

	primero := jsonBody(t, validRegisterRequest("Uno", "invalidacodigo@example.com", "password123"))
	h.register(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/auth/register", primero))
	codigoViejo := codigoDe(t, tx, "invalidacodigo@example.com")

	segundo := jsonBody(t, validRegisterRequest("Dos", "invalidacodigo@example.com", "otraPassword123"))
	h.register(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/auth/register", segundo))

	confirmarViejo := jsonBody(t, confirmarRequest{Email: "invalidacodigo@example.com", Codigo: codigoViejo})
	rec := httptest.NewRecorder()
	h.confirmar(rec, httptest.NewRequest(http.MethodPost, "/auth/confirmar", confirmarViejo))

	if rec.Code == http.StatusOK {
		t.Error("el código del primer intento debería haber quedado invalidado por el reintento")
	}
}

// --- Validación de confirmarEmail/confirmarPassword en el backend
//     (2026-08-18, Prompt 2: "Validá también en el backend que los dos
//     campos de email coincidan y que las dos contraseñas coincidan") ---

func TestRegister_RechazaSiLosEmailsNoCoinciden(t *testing.T) {
	tx := testdb.New(t)
	h := &authHandler{db: tx, jwtSecret: testSecret}

	req := validRegisterRequest("Test", "uno@example.com", "password123")
	req.ConfirmarEmail = "otro@example.com"
	rec := httptest.NewRecorder()
	h.register(rec, httptest.NewRequest(http.MethodPost, "/auth/register", jsonBody(t, req)))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusBadRequest, rec.Body.String())
	}
	var count int64
	tx.Model(&db.Usuario{}).Where("email = ?", "uno@example.com").Count(&count)
	if count != 0 {
		t.Error("no debería haberse creado ningún usuario con emails que no coinciden")
	}
}

func TestRegister_RechazaSiLasPasswordsNoCoinciden(t *testing.T) {
	tx := testdb.New(t)
	h := &authHandler{db: tx, jwtSecret: testSecret}

	req := validRegisterRequest("Test", "passmismatch@example.com", "password123")
	req.ConfirmarPassword = "otraPassword123"
	rec := httptest.NewRecorder()
	h.register(rec, httptest.NewRequest(http.MethodPost, "/auth/register", jsonBody(t, req)))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusBadRequest, rec.Body.String())
	}
	var count int64
	tx.Model(&db.Usuario{}).Where("email = ?", "passmismatch@example.com").Count(&count)
	if count != 0 {
		t.Error("no debería haberse creado ningún usuario con contraseñas que no coinciden")
	}
}

func TestRegister_ValidaCamposRequeridos(t *testing.T) {
	casos := []struct {
		nombre string
		req    registerRequest
	}{
		{"nombre vacío", validRegisterRequest("  ", "valido@example.com", "password123")},
		{"email inválido", validRegisterRequest("Test", "no-es-un-email", "password123")},
		{"password corta", validRegisterRequest("Test", "valido2@example.com", "corta")},
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
	body := jsonBody(t, validRegisterRequest("Test", "sincaptcha@example.com", "password123"))
	rec := httptest.NewRecorder()
	h.register(rec, httptest.NewRequest(http.MethodPost, "/auth/register", body))

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusCreated, rec.Body.String())
	}
}

func TestRegister_ConCaptchaConfiguradoPeroSinTokenDaBadRequest(t *testing.T) {
	h := &authHandler{db: testdb.New(t), jwtSecret: testSecret, captcha: fakeCaptcha{ok: true}}
	body := jsonBody(t, validRegisterRequest("Test", "sintoken@example.com", "password123"))
	rec := httptest.NewRecorder()
	h.register(rec, httptest.NewRequest(http.MethodPost, "/auth/register", body))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusBadRequest, rec.Body.String())
	}
}

func TestRegister_CaptchaRechazadoDaBadRequestYNoCreaElUsuario(t *testing.T) {
	tx := testdb.New(t)
	h := &authHandler{db: tx, jwtSecret: testSecret, captcha: fakeCaptcha{ok: false}}
	req := validRegisterRequest("Test", "rechazado@example.com", "password123")
	req.CaptchaToken = "token-cualquiera"
	rec := httptest.NewRecorder()
	h.register(rec, httptest.NewRequest(http.MethodPost, "/auth/register", jsonBody(t, req)))

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
	req := validRegisterRequest("Test", "errorcaptcha@example.com", "password123")
	req.CaptchaToken = "token-cualquiera"
	rec := httptest.NewRecorder()
	h.register(rec, httptest.NewRequest(http.MethodPost, "/auth/register", jsonBody(t, req)))

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusInternalServerError, rec.Body.String())
	}
}

func TestRegister_CaptchaAprobadoCreaElUsuario(t *testing.T) {
	h := &authHandler{db: testdb.New(t), jwtSecret: testSecret, captcha: fakeCaptcha{ok: true}}
	req := validRegisterRequest("Test", "aprobado@example.com", "password123")
	req.CaptchaToken = "token-valido"
	rec := httptest.NewRecorder()
	h.register(rec, httptest.NewRequest(http.MethodPost, "/auth/register", jsonBody(t, req)))

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusCreated, rec.Body.String())
	}
}

// --- Envío del email de confirmación (best-effort, ver auth.go) ---

func TestRegister_MandaElCodigoPorEmailCuandoHaySender(t *testing.T) {
	sender := &fakeEmailSender{}
	h := &authHandler{db: testdb.New(t), jwtSecret: testSecret, email: sender}
	body := jsonBody(t, validRegisterRequest("Test", "conemail@example.com", "password123"))
	rec := httptest.NewRecorder()
	h.register(rec, httptest.NewRequest(http.MethodPost, "/auth/register", body))

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusCreated, rec.Body.String())
	}
	if len(sender.enviados) != 1 {
		t.Fatalf("se mandaron %d emails, esperaba 1", len(sender.enviados))
	}
	if sender.enviados[0].to != "conemail@example.com" {
		t.Errorf("to = %q, esperaba %q", sender.enviados[0].to, "conemail@example.com")
	}
}

func TestRegister_SinSenderConfiguradoNoRompe(t *testing.T) {
	// h.email nil (no seteado) — el mismo caso que la mayoría de los tests
	// de este archivo. Confirma explícitamente que registrar no explota
	// por eso (guard en auth.go, mismo convenio que h.captcha).
	h := &authHandler{db: testdb.New(t), jwtSecret: testSecret}
	body := jsonBody(t, validRegisterRequest("Test", "sinsender@example.com", "password123"))
	rec := httptest.NewRecorder()
	h.register(rec, httptest.NewRequest(http.MethodPost, "/auth/register", body))

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusCreated, rec.Body.String())
	}
}

// --- Login ---

func TestLogin_ConCredencialesCorrectas(t *testing.T) {
	tx := testdb.New(t)
	h := &authHandler{db: tx, jwtSecret: testSecret}
	crearUsuarioConfirmado(t, tx, "Login Test", "login@example.com", "password123")

	login := jsonBody(t, loginRequest{Email: "LOGIN@example.com", Password: "password123"})
	rec := httptest.NewRecorder()
	h.login(rec, httptest.NewRequest(http.MethodPost, "/auth/login", login))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusOK, rec.Body.String())
	}
}

func TestLogin_PasswordIncorrectaDaUnauthorized(t *testing.T) {
	tx := testdb.New(t)
	h := &authHandler{db: tx, jwtSecret: testSecret}
	crearUsuarioConfirmado(t, tx, "Test", "wrongpass@example.com", "password123")

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

// Prompt 2: una cuenta recién registrada (por email/contraseña) no puede
// loguearse hasta confirmar el código — 403, no 401, para que el frontend
// lo distinga de "contraseña incorrecta".
func TestLogin_CuentaSinConfirmarDaForbidden(t *testing.T) {
	tx := testdb.New(t)
	h := &authHandler{db: tx, jwtSecret: testSecret}
	registro := jsonBody(t, validRegisterRequest("Sin Confirmar", "sinconfirmar@example.com", "password123"))
	h.register(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/auth/register", registro))

	login := jsonBody(t, loginRequest{Email: "sinconfirmar@example.com", Password: "password123"})
	rec := httptest.NewRecorder()
	h.login(rec, httptest.NewRequest(http.MethodPost, "/auth/login", login))

	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusForbidden, rec.Body.String())
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

// --- Confirmar cuenta (Prompt 2) ---

func TestConfirmar_CodigoCorrectoActivaLaCuentaYDevuelveToken(t *testing.T) {
	tx := testdb.New(t)
	h := &authHandler{db: tx, jwtSecret: testSecret}
	registro := jsonBody(t, validRegisterRequest("Test", "confirmar@example.com", "password123"))
	h.register(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/auth/register", registro))
	codigo := codigoDe(t, tx, "confirmar@example.com")

	body := jsonBody(t, confirmarRequest{Email: "CONFIRMAR@example.com", Codigo: codigo})
	rec := httptest.NewRecorder()
	h.confirmar(rec, httptest.NewRequest(http.MethodPost, "/auth/confirmar", body))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	var resp authResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("no se pudo parsear la respuesta: %v", err)
	}
	if resp.Token == "" {
		t.Error("esperaba un token no vacío")
	}

	var usuario db.Usuario
	tx.Where("email = ?", "confirmar@example.com").First(&usuario)
	if !usuario.EmailConfirmado {
		t.Error("EmailConfirmado debería quedar true")
	}
	if usuario.CodigoConfirmacion != nil || usuario.CodigoExpiracion != nil {
		t.Error("el código debería limpiarse después de confirmar")
	}

	// La cuenta ya confirmada ahora sí puede loguearse.
	login := jsonBody(t, loginRequest{Email: "confirmar@example.com", Password: "password123"})
	recLogin := httptest.NewRecorder()
	h.login(recLogin, httptest.NewRequest(http.MethodPost, "/auth/login", login))
	if recLogin.Code != http.StatusOK {
		t.Errorf("login después de confirmar: status = %d, esperaba %d", recLogin.Code, http.StatusOK)
	}
}

func TestConfirmar_CodigoIncorrectoDaBadRequest(t *testing.T) {
	tx := testdb.New(t)
	h := &authHandler{db: tx, jwtSecret: testSecret}
	registro := jsonBody(t, validRegisterRequest("Test", "codigomalo@example.com", "password123"))
	h.register(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/auth/register", registro))

	body := jsonBody(t, confirmarRequest{Email: "codigomalo@example.com", Codigo: "000000"})
	rec := httptest.NewRecorder()
	h.confirmar(rec, httptest.NewRequest(http.MethodPost, "/auth/confirmar", body))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusBadRequest, rec.Body.String())
	}

	var usuario db.Usuario
	tx.Where("email = ?", "codigomalo@example.com").First(&usuario)
	if usuario.EmailConfirmado {
		t.Error("no debería confirmarse con un código incorrecto")
	}
}

func TestConfirmar_CodigoVencidoDaBadRequest(t *testing.T) {
	tx := testdb.New(t)
	h := &authHandler{db: tx, jwtSecret: testSecret}
	registro := jsonBody(t, validRegisterRequest("Test", "vencido@example.com", "password123"))
	h.register(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/auth/register", registro))
	codigo := codigoDe(t, tx, "vencido@example.com")

	// Forzamos que ya haya vencido — sin esperar los 15 minutos reales.
	vencida := clock.Now().Add(-time.Minute)
	tx.Model(&db.Usuario{}).Where("email = ?", "vencido@example.com").Update("codigo_expiracion", vencida)

	body := jsonBody(t, confirmarRequest{Email: "vencido@example.com", Codigo: codigo})
	rec := httptest.NewRecorder()
	h.confirmar(rec, httptest.NewRequest(http.MethodPost, "/auth/confirmar", body))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusBadRequest, rec.Body.String())
	}
}

func TestConfirmar_EmailInexistenteDaBadRequest(t *testing.T) {
	h := &authHandler{db: testdb.New(t), jwtSecret: testSecret}
	body := jsonBody(t, confirmarRequest{Email: "no-existe@example.com", Codigo: "123456"})
	rec := httptest.NewRecorder()
	h.confirmar(rec, httptest.NewRequest(http.MethodPost, "/auth/confirmar", body))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

func TestConfirmar_CuentaYaConfirmadaEsIdempotente(t *testing.T) {
	tx := testdb.New(t)
	h := &authHandler{db: tx, jwtSecret: testSecret}
	crearUsuarioConfirmado(t, tx, "Test", "yaconfirmado@example.com", "password123")

	body := jsonBody(t, confirmarRequest{Email: "yaconfirmado@example.com", Codigo: "cualquier-cosa"})
	rec := httptest.NewRecorder()
	h.confirmar(rec, httptest.NewRequest(http.MethodPost, "/auth/confirmar", body))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, esperaba %d (idempotente) — body: %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	var resp authResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("no se pudo parsear la respuesta: %v", err)
	}
	if resp.Token == "" {
		t.Error("esperaba un token no vacío (login automático)")
	}
}

func TestConfirmar_CuerpoInvalidoDaBadRequest(t *testing.T) {
	h := &authHandler{db: testdb.New(t), jwtSecret: testSecret}
	rec := httptest.NewRecorder()
	h.confirmar(rec, httptest.NewRequest(http.MethodPost, "/auth/confirmar", bytes.NewBufferString("{invalido")))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

// --- Reenviar código (Prompt 2) ---

func TestReenviarCodigo_GeneraUnCodigoNuevoParaCuentaSinConfirmar(t *testing.T) {
	tx := testdb.New(t)
	h := &authHandler{db: tx, jwtSecret: testSecret}
	registro := jsonBody(t, validRegisterRequest("Test", "reenviar@example.com", "password123"))
	h.register(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/auth/register", registro))
	codigoViejo := codigoDe(t, tx, "reenviar@example.com")

	body := jsonBody(t, reenviarCodigoRequest{Email: "REENVIAR@example.com"})
	rec := httptest.NewRecorder()
	h.reenviarCodigo(rec, httptest.NewRequest(http.MethodPost, "/auth/reenviar-codigo", body))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	// El código viejo ya no sirve — confirmar() con ese código tiene que
	// rechazarlo.
	confirmarViejo := jsonBody(t, confirmarRequest{Email: "reenviar@example.com", Codigo: codigoViejo})
	recConfirmar := httptest.NewRecorder()
	h.confirmar(recConfirmar, httptest.NewRequest(http.MethodPost, "/auth/confirmar", confirmarViejo))
	if recConfirmar.Code == http.StatusOK {
		t.Error("el código viejo debería haber quedado invalidado por el reenvío")
	}

	// El código nuevo sí confirma.
	nuevo := codigoDe(t, tx, "reenviar@example.com")
	confirmarNuevo := jsonBody(t, confirmarRequest{Email: "reenviar@example.com", Codigo: nuevo})
	recNuevo := httptest.NewRecorder()
	h.confirmar(recNuevo, httptest.NewRequest(http.MethodPost, "/auth/confirmar", confirmarNuevo))
	if recNuevo.Code != http.StatusOK {
		t.Errorf("confirmar con el código nuevo: status = %d, esperaba %d", recNuevo.Code, http.StatusOK)
	}
}

// Anti-enumeración: mismo status/mensaje exista o no exista la cuenta.
func TestReenviarCodigo_EmailInexistenteDaRespuestaGenerica(t *testing.T) {
	h := &authHandler{db: testdb.New(t), jwtSecret: testSecret}
	body := jsonBody(t, reenviarCodigoRequest{Email: "no-existe@example.com"})
	rec := httptest.NewRecorder()
	h.reenviarCodigo(rec, httptest.NewRequest(http.MethodPost, "/auth/reenviar-codigo", body))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, esperaba %d (respuesta genérica, no debe revelar si el email existe)", rec.Code, http.StatusOK)
	}
}

func TestReenviarCodigo_CuentaYaConfirmadaDaRespuestaGenericaYNoTocaNada(t *testing.T) {
	tx := testdb.New(t)
	h := &authHandler{db: tx, jwtSecret: testSecret}
	crearUsuarioConfirmado(t, tx, "Test", "yaconfirmado2@example.com", "password123")

	body := jsonBody(t, reenviarCodigoRequest{Email: "yaconfirmado2@example.com"})
	rec := httptest.NewRecorder()
	h.reenviarCodigo(rec, httptest.NewRequest(http.MethodPost, "/auth/reenviar-codigo", body))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusOK)
	}
	var usuario db.Usuario
	tx.Where("email = ?", "yaconfirmado2@example.com").First(&usuario)
	if usuario.CodigoConfirmacion != nil {
		t.Error("no debería generarse un código para una cuenta ya confirmada")
	}
}

func TestReenviarCodigo_CuerpoInvalidoDaBadRequest(t *testing.T) {
	h := &authHandler{db: testdb.New(t), jwtSecret: testSecret}
	rec := httptest.NewRecorder()
	h.reenviarCodigo(rec, httptest.NewRequest(http.MethodPost, "/auth/reenviar-codigo", bytes.NewBufferString("{invalido")))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

// --- Google Sign-In (Prompt 2) ---

func TestGoogle_SinExchangerConfiguradoDaInternalServerError(t *testing.T) {
	h := &authHandler{db: testdb.New(t), jwtSecret: testSecret}
	body := jsonBody(t, googleRequest{Code: "cualquier-code"})
	rec := httptest.NewRecorder()
	h.google_(rec, httptest.NewRequest(http.MethodPost, "/auth/google", body))

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusInternalServerError, rec.Body.String())
	}
}

func TestGoogle_CodeVacioDaBadRequest(t *testing.T) {
	h := &authHandler{db: testdb.New(t), jwtSecret: testSecret, google: fakeGoogleExchanger{}}
	body := jsonBody(t, googleRequest{Code: ""})
	rec := httptest.NewRecorder()
	h.google_(rec, httptest.NewRequest(http.MethodPost, "/auth/google", body))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

func TestGoogle_ExchangeFallaDaBadRequest(t *testing.T) {
	h := &authHandler{db: testdb.New(t), jwtSecret: testSecret, google: fakeGoogleExchanger{err: errors.New("code inválido")}}
	body := jsonBody(t, googleRequest{Code: "code-invalido"})
	rec := httptest.NewRecorder()
	h.google_(rec, httptest.NewRequest(http.MethodPost, "/auth/google", body))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusBadRequest, rec.Body.String())
	}
}

func TestGoogle_CreaUsuarioNuevoConfirmadoDeEntrada(t *testing.T) {
	tx := testdb.New(t)
	gu := googleauth.GoogleUser{Sub: "google-sub-1", Email: "nuevo@gmail.com", EmailVerified: true, Name: "Google User"}
	h := &authHandler{db: tx, jwtSecret: testSecret, google: fakeGoogleExchanger{user: gu}}
	body := jsonBody(t, googleRequest{Code: "code-valido"})
	rec := httptest.NewRecorder()
	h.google_(rec, httptest.NewRequest(http.MethodPost, "/auth/google", body))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	var resp authResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("no se pudo parsear la respuesta: %v", err)
	}
	if resp.Token == "" {
		t.Error("esperaba un token no vacío")
	}
	if resp.Usuario.Nombre != "Google User" {
		t.Errorf("Nombre = %q, esperaba %q", resp.Usuario.Nombre, "Google User")
	}

	var usuario db.Usuario
	tx.Where("email = ?", "nuevo@gmail.com").First(&usuario)
	if !usuario.EmailConfirmado {
		t.Error("una cuenta creada por Google debería quedar confirmada de entrada")
	}
	if usuario.GoogleID == nil || *usuario.GoogleID != "google-sub-1" {
		t.Errorf("GoogleID = %v, esperaba %q", usuario.GoogleID, "google-sub-1")
	}
}

func TestGoogle_SinNombreUsaLaParteLocalDelEmail(t *testing.T) {
	tx := testdb.New(t)
	gu := googleauth.GoogleUser{Sub: "google-sub-sinnombre", Email: "sinnombre@gmail.com", EmailVerified: true, Name: ""}
	h := &authHandler{db: tx, jwtSecret: testSecret, google: fakeGoogleExchanger{user: gu}}
	body := jsonBody(t, googleRequest{Code: "code"})
	rec := httptest.NewRecorder()
	h.google_(rec, httptest.NewRequest(http.MethodPost, "/auth/google", body))

	var resp authResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("no se pudo parsear la respuesta: %v", err)
	}
	if resp.Usuario.Nombre != "sinnombre" {
		t.Errorf("Nombre = %q, esperaba %q (parte local del email)", resp.Usuario.Nombre, "sinnombre")
	}
}

func TestGoogle_VinculaCuentaExistentePorEmail(t *testing.T) {
	tx := testdb.New(t)
	existente := crearUsuarioConfirmado(t, tx, "Ya Registrada", "vincular@example.com", "password123")
	// Forzamos EmailConfirmado=false para confirmar que vincular por
	// Google también la activa (además de vincular el GoogleID).
	tx.Model(&db.Usuario{}).Where("id = ?", existente.ID).Update("email_confirmado", false)

	gu := googleauth.GoogleUser{Sub: "google-sub-vinculo", Email: "vincular@example.com", EmailVerified: true, Name: "Google Name"}
	h := &authHandler{db: tx, jwtSecret: testSecret, google: fakeGoogleExchanger{user: gu}}
	body := jsonBody(t, googleRequest{Code: "code"})
	rec := httptest.NewRecorder()
	h.google_(rec, httptest.NewRequest(http.MethodPost, "/auth/google", body))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var count int64
	tx.Model(&db.Usuario{}).Where("email = ?", "vincular@example.com").Count(&count)
	if count != 1 {
		t.Fatalf("count = %d, esperaba 1 — no debería crear una cuenta duplicada", count)
	}

	var usuario db.Usuario
	tx.Where("email = ?", "vincular@example.com").First(&usuario)
	if usuario.ID != existente.ID {
		t.Error("debería reusar la cuenta existente, no crear una nueva")
	}
	if usuario.GoogleID == nil || *usuario.GoogleID != "google-sub-vinculo" {
		t.Errorf("GoogleID = %v, esperaba %q", usuario.GoogleID, "google-sub-vinculo")
	}
	if !usuario.EmailConfirmado {
		t.Error("vincular con Google debería confirmar la cuenta de yapa")
	}
	// El nombre original (elegido por el usuario al registrarse) no se
	// pisa con el de Google — vincular no es lo mismo que sobrescribir.
	if usuario.Nombre != "Ya Registrada" {
		t.Errorf("Nombre = %q, no debería cambiar al vincular", usuario.Nombre)
	}
}

func TestGoogle_UsaCuentaYaVinculadaPorGoogleID(t *testing.T) {
	tx := testdb.New(t)
	gu := googleauth.GoogleUser{Sub: "google-sub-repetido", Email: "repetido@gmail.com", EmailVerified: true, Name: "Nombre"}
	h := &authHandler{db: tx, jwtSecret: testSecret, google: fakeGoogleExchanger{user: gu}}

	primero := httptest.NewRecorder()
	h.google_(primero, httptest.NewRequest(http.MethodPost, "/auth/google", jsonBody(t, googleRequest{Code: "code-1"})))
	segundo := httptest.NewRecorder()
	h.google_(segundo, httptest.NewRequest(http.MethodPost, "/auth/google", jsonBody(t, googleRequest{Code: "code-2"})))

	if primero.Code != http.StatusOK || segundo.Code != http.StatusOK {
		t.Fatalf("status = %d/%d, esperaba %d/%d", primero.Code, segundo.Code, http.StatusOK, http.StatusOK)
	}

	var count int64
	tx.Model(&db.Usuario{}).Where("google_id = ?", "google-sub-repetido").Count(&count)
	if count != 1 {
		t.Errorf("count = %d, esperaba 1 — dos logins con el mismo Google ID no deberían crear dos cuentas", count)
	}
}

func TestGoogle_CuerpoInvalidoDaBadRequest(t *testing.T) {
	h := &authHandler{db: testdb.New(t), jwtSecret: testSecret, google: fakeGoogleExchanger{}}
	rec := httptest.NewRecorder()
	h.google_(rec, httptest.NewRequest(http.MethodPost, "/auth/google", bytes.NewBufferString("{invalido")))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

// --- /me (sin cambios de comportamiento, solo adaptado a que register ya
//     no devuelve token — usa crearUsuarioConfirmado + login para
//     conseguir uno) ---

func TestMeHandler_DevuelveElUsuarioAutenticado(t *testing.T) {
	tx := testdb.New(t)
	h := &authHandler{db: tx, jwtSecret: testSecret}
	crearUsuarioConfirmado(t, tx, "Me Test", "me@example.com", "password123")

	login := jsonBody(t, loginRequest{Email: "me@example.com", Password: "password123"})
	recLogin := httptest.NewRecorder()
	h.login(recLogin, httptest.NewRequest(http.MethodPost, "/auth/login", login))
	var logueado authResponse
	if err := json.Unmarshal(recLogin.Body.Bytes(), &logueado); err != nil {
		t.Fatalf("no se pudo parsear la respuesta del login: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/me", nil)
	req.Header.Set("Authorization", "Bearer "+logueado.Token)
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
	usuario := crearUsuarioConfirmado(t, tx, "Efímero", "efimero@example.com", "password123")

	login := jsonBody(t, loginRequest{Email: "efimero@example.com", Password: "password123"})
	recLogin := httptest.NewRecorder()
	h.login(recLogin, httptest.NewRequest(http.MethodPost, "/auth/login", login))
	var logueado authResponse
	if err := json.Unmarshal(recLogin.Body.Bytes(), &logueado); err != nil {
		t.Fatalf("no se pudo parsear la respuesta del login: %v", err)
	}

	if err := tx.Exec("DELETE FROM usuarios WHERE id = ?", usuario.ID).Error; err != nil {
		t.Fatalf("no se pudo borrar el usuario de prueba: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/me", nil)
	req.Header.Set("Authorization", "Bearer "+logueado.Token)
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
