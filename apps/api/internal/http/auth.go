package http

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/mail"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"turismo-marcuzzi/api/internal/auth"
	"turismo-marcuzzi/api/internal/db"
)

const minPasswordLen = 8

// registerAuthRoutes monta /auth/register y /auth/login (spec §4.5).
func registerAuthRoutes(r chi.Router, gdb *gorm.DB, jwtSecret string) {
	h := &authHandler{db: gdb, jwtSecret: jwtSecret}
	r.Post("/register", h.register)
	r.Post("/login", h.login)
}

type authHandler struct {
	db        *gorm.DB
	jwtSecret string
}

type registerRequest struct {
	Nombre   string  `json:"nombre"`
	Email    string  `json:"email"`
	Password string  `json:"password"`
	Telefono *string `json:"telefono,omitempty"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// usuarioResponse nunca incluye password_hash.
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

func (h *authHandler) register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "cuerpo de la petición inválido")
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Nombre = strings.TrimSpace(req.Nombre)

	if req.Nombre == "" {
		writeError(w, http.StatusBadRequest, "nombre es requerido")
		return
	}
	if _, err := mail.ParseAddress(req.Email); err != nil {
		writeError(w, http.StatusBadRequest, "email inválido")
		return
	}
	if len(req.Password) < minPasswordLen {
		writeError(w, http.StatusBadRequest, "la contraseña debe tener al menos 8 caracteres")
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

	usuario := db.Usuario{
		Nombre:       req.Nombre,
		Email:        req.Email,
		PasswordHash: string(hash),
		Telefono:     req.Telefono,
		Rol:          "cliente",
	}
	if err := h.db.Create(&usuario).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "error creando el usuario")
		return
	}

	h.respondWithToken(w, http.StatusCreated, usuario)
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

	h.respondWithToken(w, http.StatusOK, usuario)
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
