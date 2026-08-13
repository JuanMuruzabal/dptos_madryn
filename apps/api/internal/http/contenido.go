package http

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"turismo-marcuzzi/api/internal/db"
)

// registerContenidoRoutes monta los bloques de texto editables de páginas
// principales (T4.13, spec §4.8 — "editor de página") — hoy solo el
// título/descripción del listado de Alojamiento (/alojamiento), clave
// "alojamiento_listado". Lectura pública (la página necesita el texto
// para renderizar), escritura admin-only.
func registerContenidoRoutes(r chi.Router, gdb *gorm.DB, jwtSecret string) {
	h := &contenidoHandler{db: gdb}

	r.Get("/contenido-sitio/{clave}", h.get)
	r.Group(func(r chi.Router) {
		r.Use(requireAuth(jwtSecret), requireRole("administrador"))
		r.Put("/contenido-sitio/{clave}", h.actualizar)
	})
}

type contenidoHandler struct {
	db *gorm.DB
}

type contenidoResponse struct {
	Clave       string `json:"clave"`
	Titulo      string `json:"titulo"`
	Descripcion string `json:"descripcion"`
}

// get — GET /contenido-sitio/{clave}, público. Sin fila cargada todavía
// para esa clave, devuelve strings vacíos (200, no 404) — el frontend ya
// sabe mostrar su copy por defecto hardcodeado en ese caso, así que no es
// un error real, es el estado inicial esperado antes de que el admin
// edite algo.
func (h *contenidoHandler) get(w http.ResponseWriter, r *http.Request) {
	clave := chi.URLParam(r, "clave")

	var contenido db.ContenidoSitio
	err := h.db.First(&contenido, "clave = ?", clave).Error
	if err != nil {
		writeJSON(w, http.StatusOK, contenidoResponse{Clave: clave})
		return
	}

	writeJSON(w, http.StatusOK, contenidoResponse{
		Clave:       contenido.Clave,
		Titulo:      contenido.Titulo,
		Descripcion: contenido.Descripcion,
	})
}

type actualizarContenidoRequest struct {
	Titulo      string `json:"titulo"`
	Descripcion string `json:"descripcion"`
}

// actualizar — PUT /contenido-sitio/{clave} (admin). Upsert real (INSERT
// ... ON CONFLICT), no Save(): con una primary key string (Clave) que
// siempre viene seteada desde la URL, GORM's Save() la trataría siempre
// como "ya existe, hacer UPDATE" — la primera vez que se edita una clave
// nueva ese UPDATE afecta 0 filas en silencio, sin crear nada (bug real,
// atrapado antes de terminar esta ronda).
func (h *contenidoHandler) actualizar(w http.ResponseWriter, r *http.Request) {
	clave := chi.URLParam(r, "clave")

	var req actualizarContenidoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "cuerpo de la petición inválido")
		return
	}

	contenido := db.ContenidoSitio{
		Clave:       clave,
		Titulo:      strings.TrimSpace(req.Titulo),
		Descripcion: strings.TrimSpace(req.Descripcion),
	}
	err := h.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "clave"}},
		DoUpdates: clause.AssignmentColumns([]string{"titulo", "descripcion", "updated_at"}),
	}).Create(&contenido).Error
	if err != nil {
		writeError(w, http.StatusInternalServerError, "error guardando el contenido")
		return
	}

	writeJSON(w, http.StatusOK, contenidoResponse{
		Clave:       contenido.Clave,
		Titulo:      contenido.Titulo,
		Descripcion: contenido.Descripcion,
	})
}
