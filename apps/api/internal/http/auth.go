package http

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"turismo-marcuzzi/api/internal/auth"
	"turismo-marcuzzi/api/internal/clock"
	"turismo-marcuzzi/api/internal/db"
	"turismo-marcuzzi/api/internal/email"
	"turismo-marcuzzi/api/internal/googleauth"
	"turismo-marcuzzi/api/internal/turnstile"
)

const minPasswordLen = 8

// codigoConfirmacionTTL — 15 minutos entre que se genera un código y que
// deja de servir (register o reenviar-codigo). Ni tan corto que un
// usuario normal no llegue a mirar el email a tiempo, ni tan largo que un
// código filtrado (p. ej. un email reenviado sin querer) quede útil por
// horas (2026-08-18, Prompt 2 de docs/prompts-login (1).md).
const codigoConfirmacionTTL = 15 * time.Minute

// registerAuthRoutes monta /auth/register, /auth/login, /auth/confirmar,
// /auth/reenviar-codigo y /auth/google (spec §4.5, Prompt 2). captcha nil
// deshabilita la verificación anti-bot del registro; google nil deshabilita
// /auth/google (devuelve un error claro en vez de romper) — ambos solo
// pensados para tests que no los ejercitan a propósito; en producción/
// desarrollo real siempre vienen seteados desde cmd/api/main.go.
func registerAuthRoutes(r chi.Router, gdb *gorm.DB, jwtSecret string, captcha turnstile.Verifier, sender email.Sender, google googleauth.Exchanger) {
	h := &authHandler{db: gdb, jwtSecret: jwtSecret, captcha: captcha, email: sender, google: google}
	r.Post("/register", h.register)
	r.Post("/login", h.login)
	r.Post("/confirmar", h.confirmar)
	r.Post("/reenviar-codigo", h.reenviarCodigo)
	r.Post("/google", h.google_)
}

type authHandler struct {
	db        *gorm.DB
	jwtSecret string
	captcha   turnstile.Verifier
	email     email.Sender
	google    googleauth.Exchanger
}

type registerRequest struct {
	Nombre   string  `json:"nombre"`
	Email    string  `json:"email"`
	Password string  `json:"password"`
	Telefono *string `json:"telefono,omitempty"`
	// ConfirmarEmail/ConfirmarPassword (2026-08-18, Prompt 2): el frontend
	// ya valida esto mismo antes de enviar el form (TR-048), pero el
	// pedido explícito de este prompt es que el backend Go TAMBIÉN lo
	// verifique — defensa en profundidad real, no solo confiar en que
	// nadie le pega directo a la API salteándose la UI.
	ConfirmarEmail    string `json:"confirmarEmail"`
	ConfirmarPassword string `json:"confirmarPassword"`
	// CaptchaToken (2026-08-17, TR-047) — el token que devuelve el widget
	// de Cloudflare Turnstile en el frontend; se verifica acá contra la
	// API de Cloudflare antes de crear la cuenta (ver h.captcha).
	CaptchaToken string `json:"captchaToken"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type confirmarRequest struct {
	Email  string `json:"email"`
	Codigo string `json:"codigo"`
}

type reenviarCodigoRequest struct {
	Email string `json:"email"`
}

type googleRequest struct {
	// Code es el authorization code que devuelve Google Identity Services
	// en el navegador (initCodeClient, modo popup) — se intercambia acá,
	// nunca del lado del cliente, porque hace falta el client secret.
	Code string `json:"code"`
}

// usuarioResponse nunca incluye password_hash, código de confirmación ni
// google_id — nada de eso es asunto del frontend.
type usuarioResponse struct {
	ID       string  `json:"id"`
	Nombre   string  `json:"nombre"`
	Email    string  `json:"email"`
	Telefono *string `json:"telefono,omitempty"`
	Rol      string  `json:"rol"`
}

type authResponse struct {
	Usuario usuarioResponse `json:"usuario"`
	Token   string          `json:"token"`
}

// registerResponse — a diferencia de login/confirmar/google, registrarse
// YA NO devuelve un token (2026-08-18, Prompt 2): la cuenta queda
// "pendiente de confirmación" hasta que el usuario ingresa el código que
// le llega por email — RequiereConfirmacion=true se lo indica al frontend
// para que redirija a esa pantalla en vez de asumir que ya hay sesión.
type registerResponse struct {
	Usuario              usuarioResponse `json:"usuario"`
	RequiereConfirmacion bool            `json:"requiereConfirmacion"`
}

func (h *authHandler) register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "cuerpo de la petición inválido")
		return
	}

	// Verificación anti-bot (TR-047) — ANTES de tocar la base, para no
	// gastar una consulta/hash de bcrypt en un intento que ni siquiera
	// pasó el CAPTCHA. h.captcha nil (solo en tests que no la ejercitan a
	// propósito) salta este chequeo entero.
	if h.captcha != nil {
		if req.CaptchaToken == "" {
			writeError(w, http.StatusBadRequest, "falta la verificación anti-bot")
			return
		}
		ok, err := h.captcha.Verify(req.CaptchaToken, r.RemoteAddr)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "error verificando el captcha")
			return
		}
		if !ok {
			writeError(w, http.StatusBadRequest, "verificación anti-bot inválida — probá de nuevo")
			return
		}
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.ConfirmarEmail = strings.TrimSpace(strings.ToLower(req.ConfirmarEmail))
	req.Nombre = strings.TrimSpace(req.Nombre)

	if req.Nombre == "" {
		writeError(w, http.StatusBadRequest, "nombre es requerido")
		return
	}
	if _, err := mail.ParseAddress(req.Email); err != nil {
		writeError(w, http.StatusBadRequest, "email inválido")
		return
	}
	// Defensa en profundidad (Prompt 2) — el frontend ya lo valida, esto
	// cubre a cualquiera que le pegue directo a la API.
	if req.Email != req.ConfirmarEmail {
		writeError(w, http.StatusBadRequest, "los emails no coinciden")
		return
	}
	if len(req.Password) < minPasswordLen {
		writeError(w, http.StatusBadRequest, "la contraseña debe tener al menos 8 caracteres")
		return
	}
	if req.Password != req.ConfirmarPassword {
		writeError(w, http.StatusBadRequest, "las contraseñas no coinciden")
		return
	}

	var existing db.Usuario
	err := h.db.Where("email = ?", req.Email).First(&existing).Error
	if err == nil {
		writeError(w, http.StatusConflict, "ya existe una cuenta con ese email")
		return
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		writeError(w, http.StatusInternalServerError, "error consultando usuarios")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "error generando la contraseña")
		return
	}

	codigo, err := generarCodigoConfirmacion()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "error generando el código de confirmación")
		return
	}
	expiracion := clock.Now().Add(codigoConfirmacionTTL)

	usuario := db.Usuario{
		Nombre:             req.Nombre,
		Email:              req.Email,
		PasswordHash:       string(hash),
		Telefono:           req.Telefono,
		Rol:                "cliente",
		EmailConfirmado:    false,
		CodigoConfirmacion: &codigo,
		CodigoExpiracion:   &expiracion,
	}
	if err := h.db.Create(&usuario).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "error creando el usuario")
		return
	}

	h.enviarCodigoConfirmacion(usuario, codigo)

	writeJSON(w, http.StatusCreated, registerResponse{
		Usuario:              toUsuarioResponse(usuario),
		RequiereConfirmacion: true,
	})
}

func (h *authHandler) login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "cuerpo de la petición inválido")
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	var usuario db.Usuario
	err := h.db.Where("email = ?", req.Email).First(&usuario).Error
	if err != nil {
		// Mismo mensaje que password incorrecta: no revelar si el email existe.
		writeError(w, http.StatusUnauthorized, "email o contraseña inválidos")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(usuario.PasswordHash), []byte(req.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "email o contraseña inválidos")
		return
	}

	// Prompt 2: una cuenta creada por email/contraseña no puede loguearse
	// hasta confirmar el código — status distinto (403, no 401) para que
	// el frontend lo distinga de "contraseña incorrecta" y pueda mandar al
	// usuario directo a la pantalla de confirmación en vez de un error
	// genérico sin salida.
	if !usuario.EmailConfirmado {
		writeError(w, http.StatusForbidden, "confirmá tu cuenta antes de ingresar — te mandamos un código a tu email")
		return
	}

	h.respondWithToken(w, http.StatusOK, usuario)
}

// confirmar — POST /auth/confirmar: valida el código de 6 dígitos que le
// llegó por email al registrarse y activa la cuenta. Éxito = login
// automático (devuelve token), igual que si acabara de loguearse.
func (h *authHandler) confirmar(w http.ResponseWriter, r *http.Request) {
	var req confirmarRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "cuerpo de la petición inválido")
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Codigo = strings.TrimSpace(req.Codigo)

	var usuario db.Usuario
	if err := h.db.Where("email = ?", req.Email).First(&usuario).Error; err != nil {
		writeError(w, http.StatusBadRequest, "código incorrecto o vencido")
		return
	}

	// Ya confirmada — idempotente (p. ej. doble click, o confirmar en dos
	// pestañas): loguea igual, en vez de tirar un error confuso por algo
	// que ya se cumplió.
	if usuario.EmailConfirmado {
		h.respondWithToken(w, http.StatusOK, usuario)
		return
	}

	if usuario.CodigoConfirmacion == nil || *usuario.CodigoConfirmacion != req.Codigo {
		writeError(w, http.StatusBadRequest, "código incorrecto o vencido")
		return
	}
	if usuario.CodigoExpiracion == nil || clock.Now().After(*usuario.CodigoExpiracion) {
		writeError(w, http.StatusBadRequest, "el código venció — pedí uno nuevo")
		return
	}

	usuario.EmailConfirmado = true
	usuario.CodigoConfirmacion = nil
	usuario.CodigoExpiracion = nil
	if err := h.db.Save(&usuario).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "error confirmando la cuenta")
		return
	}

	h.respondWithToken(w, http.StatusOK, usuario)
}

// reenviarCodigo — POST /auth/reenviar-codigo. Respuesta SIEMPRE genérica
// (200, mismo mensaje) exista o no exista esa cuenta, y esté o no ya
// confirmada — mismo criterio anti-enumeración que login ("mismo mensaje
// que password incorrecta"): no darle a un atacante una forma de
// verificar qué emails están registrados.
func (h *authHandler) reenviarCodigo(w http.ResponseWriter, r *http.Request) {
	var req reenviarCodigoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "cuerpo de la petición inválido")
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	const mensaje = "si el email existe y no fue confirmado todavía, te mandamos un código nuevo"

	var usuario db.Usuario
	err := h.db.Where("email = ?", req.Email).First(&usuario).Error
	if err != nil || usuario.EmailConfirmado {
		writeJSON(w, http.StatusOK, map[string]string{"mensaje": mensaje})
		return
	}

	codigo, err := generarCodigoConfirmacion()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "error generando el código de confirmación")
		return
	}
	expiracion := clock.Now().Add(codigoConfirmacionTTL)
	usuario.CodigoConfirmacion = &codigo
	usuario.CodigoExpiracion = &expiracion
	if err := h.db.Save(&usuario).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "error generando el código de confirmación")
		return
	}

	h.enviarCodigoConfirmacion(usuario, codigo)

	writeJSON(w, http.StatusOK, map[string]string{"mensaje": mensaje})
}

// google_ (guion bajo: "google" solo choca con el nombre del paquete
// googleauth si se llamara igual en este scope, se evita así) — POST
// /auth/google: intercambia el authorization code que mandó el frontend
// (google-signin-button.tsx) por los datos de la cuenta de Google, y crea
// o vincula el Usuario correspondiente. Login con Google no pide
// confirmación de email aparte: Google ya lo verificó.
func (h *authHandler) google_(w http.ResponseWriter, r *http.Request) {
	if h.google == nil {
		writeError(w, http.StatusInternalServerError, "el ingreso con Google no está configurado todavía")
		return
	}

	var req googleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "cuerpo de la petición inválido")
		return
	}
	if req.Code == "" {
		writeError(w, http.StatusBadRequest, "falta el code de Google")
		return
	}

	googleUser, err := h.google.Exchange(r.Context(), req.Code)
	if err != nil {
		writeError(w, http.StatusBadRequest, "no pudimos verificar tu cuenta de Google — probá de nuevo")
		return
	}
	emailNormalizado := strings.TrimSpace(strings.ToLower(googleUser.Email))

	usuario, err := h.buscarOCrearUsuarioGoogle(googleUser, emailNormalizado)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "error creando o vinculando la cuenta")
		return
	}

	h.respondWithToken(w, http.StatusOK, usuario)
}

// buscarOCrearUsuarioGoogle — primero por GoogleID (ya vinculada antes),
// después por email (cuenta creada por email/contraseña que ahora se
// vincula a Google — se marca EmailConfirmado=true de yapa, si no lo
// estaba), y si no existe por ninguno de los dos, crea una cuenta nueva.
func (h *authHandler) buscarOCrearUsuarioGoogle(gu googleauth.GoogleUser, emailNormalizado string) (db.Usuario, error) {
	var usuario db.Usuario

	err := h.db.Where("google_id = ?", gu.Sub).First(&usuario).Error
	if err == nil {
		return usuario, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return db.Usuario{}, err
	}

	err = h.db.Where("email = ?", emailNormalizado).First(&usuario).Error
	if err == nil {
		usuario.GoogleID = &gu.Sub
		usuario.EmailConfirmado = true
		if err := h.db.Save(&usuario).Error; err != nil {
			return db.Usuario{}, err
		}
		return usuario, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return db.Usuario{}, err
	}

	passwordAleatoria, err := generarPasswordHashAleatoria()
	if err != nil {
		return db.Usuario{}, err
	}

	nombre := strings.TrimSpace(gu.Name)
	if nombre == "" {
		// Google no siempre devuelve "name" — cae a la parte local del
		// email antes que dejar el nombre vacío.
		nombre = strings.SplitN(emailNormalizado, "@", 2)[0]
	}

	usuario = db.Usuario{
		Nombre:          nombre,
		Email:           emailNormalizado,
		PasswordHash:    passwordAleatoria,
		Rol:             "cliente",
		EmailConfirmado: true,
		GoogleID:        &gu.Sub,
	}
	if err := h.db.Create(&usuario).Error; err != nil {
		return db.Usuario{}, err
	}
	return usuario, nil
}

func (h *authHandler) enviarCodigoConfirmacion(usuario db.Usuario, codigo string) {
	// h.email nil (mismo convenio que h.captcha/h.google) — solo pasa en
	// tests que no ejercitan el envío a propósito; en producción/desarrollo
	// real cmd/api/main.go siempre lo setea (ResendSender o, como mínimo,
	// LogSender — nunca queda nil de verdad fuera de un test).
	if h.email == nil {
		return
	}

	asunto := "Confirmá tu cuenta — Turismo Marcuzzi"
	cuerpo := fmt.Sprintf(
		"Hola %s,\n\nTu código de confirmación es: %s\n\nVence en %d minutos. Si no pediste crear una cuenta, ignorá este email.\n\nTurismo Marcuzzi",
		usuario.Nombre, codigo, int(codigoConfirmacionTTL.Minutes()),
	)
	// Best-effort (mismo criterio que reservas.go/sendConfirmacion): si
	// falla, no tira abajo la respuesta — la cuenta ya está creada y
	// "reenviar código" (h.reenviarCodigo) es la vía de recuperación.
	// context.Background() a propósito, no un context de request: no
	// depende de que el request siga "vivo" en el momento exacto del envío.
	if err := h.email.Send(context.Background(), usuario.Email, asunto, cuerpo); err != nil {
		fmt.Printf("error enviando código de confirmación a %s: %v\n", usuario.Email, err)
	}
}

func (h *authHandler) respondWithToken(w http.ResponseWriter, status int, usuario db.Usuario) {
	token, err := auth.GenerateToken(h.jwtSecret, usuario.ID, usuario.Rol)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "error generando el token")
		return
	}

	writeJSON(w, status, authResponse{
		Usuario: toUsuarioResponse(usuario),
		Token:   token,
	})
}

func toUsuarioResponse(u db.Usuario) usuarioResponse {
	return usuarioResponse{
		ID:       u.ID.String(),
		Nombre:   u.Nombre,
		Email:    u.Email,
		Telefono: u.Telefono,
		Rol:      u.Rol,
	}
}

// generarCodigoConfirmacion — 6 dígitos numéricos (000000-999999),
// crypto/rand (no math/rand: es un secreto de un solo uso, tiene que ser
// impredecible de verdad).
func generarCodigoConfirmacion() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", fmt.Errorf("generando el código de confirmación: %w", err)
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// generarPasswordHashAleatoria — para cuentas creadas vía Google, que no
// eligen contraseña propia. Un hash de bcrypt de un UUID aleatorio: nadie
// puede loguearse con password para esa cuenta (nadie conoce el UUID), sin
// tener que volver nullable la columna password_hash existente.
func generarPasswordHashAleatoria() (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(uuid.NewString()), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("generando la contraseña aleatoria: %w", err)
	}
	return string(hash), nil
}

// meHandler — GET /me (protegida por requireAuth): datos del usuario
// autenticado. Existe porque el JWT deliberadamente no lleva nombre/email
// (spec de Next.js: minimizar PII en el payload del token), así que el
// frontend necesita esta llamada para mostrar el perfil (T1.3).
func meHandler(gdb *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := claimsFromContext(r)
		if !ok {
			writeError(w, http.StatusUnauthorized, "falta el token de autenticación")
			return
		}

		usuarioID, err := uuid.Parse(claims.Subject)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "token inválido")
			return
		}

		var usuario db.Usuario
		if err := gdb.First(&usuario, "id = ?", usuarioID).Error; err != nil {
			writeError(w, http.StatusNotFound, "usuario no encontrado")
			return
		}

		writeJSON(w, http.StatusOK, toUsuarioResponse(usuario))
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
