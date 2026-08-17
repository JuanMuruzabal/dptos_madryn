package http

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"turismo-marcuzzi/api/internal/db"
)

// registerResenaRoutes monta el listado público de reseñas y el alta,
// restringida a usuarios con una reserva de alojamiento `confirmada` real
// (T3.4, spec §4.2: "reseñas confiables... vincular las reseñas a
// reservas reales para evitar comentarios falsos", spec §7).
func registerResenaRoutes(r chi.Router, gdb *gorm.DB, jwtSecret string) {
	h := &resenaHandler{db: gdb}

	r.Get("/alojamientos/{id}/resenas", h.list)
	r.With(requireAuth(jwtSecret)).Post("/alojamientos/{id}/resenas", h.create)
	// Borrado real por su dueño (2026-08-17, pedido del cliente) — a
	// diferencia de moderar (admin, oculta sin borrar), esto SÍ borra la
	// fila; el handler exige que sea el propio autor, cualquier usuario
	// autenticado puede pegarle a esta ruta pero solo borra lo suyo.
	r.With(requireAuth(jwtSecret)).Delete("/resenas/{id}", h.delete)

	// T4.5: moderación — solo admin, ve TODAS las reseñas (ocultas
	// incluidas) y puede alternar el flag.
	r.Group(func(r chi.Router) {
		r.Use(requireAuth(jwtSecret), requireRole("administrador"))
		r.Get("/resenas", h.listAdmin)
		r.Patch("/resenas/{id}", h.moderar)
	})
}

type resenaHandler struct {
	db *gorm.DB
}

type resenaResponse struct {
	ID string `json:"id"`
	// UsuarioID (2026-08-17): el frontend lo compara contra el usuario
	// logueado para decidir si mostrar el botón de borrar en ESA reseña
	// puntual — nunca se usa para autorizar nada del lado del servidor,
	// eso lo hace delete() de nuevo, sin confiar en lo que mande el cliente.
	UsuarioID     string `json:"usuarioId"`
	UsuarioNombre string `json:"usuarioNombre"`
	Rating        int    `json:"rating"`
	Texto         string `json:"texto"`
	CreatedAt     string `json:"createdAt"`
	// Oculta — solo relevante en el listado admin (T4.5); el listado
	// público (list) ya filtra las ocultas, así que ahí siempre viene false.
	Oculta      bool                `json:"oculta"`
	Alojamiento *alojamientoResumen `json:"alojamiento,omitempty"`
}

func toResenaResponse(res db.Resena) resenaResponse {
	out := resenaResponse{
		ID:            res.ID.String(),
		UsuarioID:     res.UsuarioID.String(),
		UsuarioNombre: res.Usuario.Nombre,
		Rating:        res.Rating,
		Texto:         res.Texto,
		CreatedAt:     res.CreatedAt.Format(time.RFC3339),
		Oculta:        res.Oculta,
	}
	if res.Alojamiento != nil {
		out.Alojamiento = &alojamientoResumen{ID: res.Alojamiento.ID.String(), Nombre: res.Alojamiento.Nombre}
	}
	return out
}

// list — GET /alojamientos/{id}/resenas, público. Filtra oculta = false
// (T4.5): una reseña moderada por el admin deja de aparecer acá sin
// borrarse de la base (spec §4.8).
func (h *resenaHandler) list(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "id inválido")
		return
	}

	var resenas []db.Resena
	err = h.db.Preload("Usuario").
		Where("alojamiento_id = ? AND oculta = ?", id, false).
		Order("created_at desc").
		Find(&resenas).Error
	if err != nil {
		writeError(w, http.StatusInternalServerError, "error obteniendo reseñas")
		return
	}

	responses := make([]resenaResponse, 0, len(resenas))
	for _, res := range resenas {
		responses = append(responses, toResenaResponse(res))
	}
	writeJSON(w, http.StatusOK, responses)
}

// listAdmin — GET /resenas (admin, T4.5): todas las reseñas de todos los
// alojamientos, ocultas incluidas, para la vista de moderación del panel.
func (h *resenaHandler) listAdmin(w http.ResponseWriter, r *http.Request) {
	var resenas []db.Resena
	err := h.db.
		Preload("Usuario").
		Preload("Alojamiento", func(tx *gorm.DB) *gorm.DB { return tx }).
		Order("created_at desc").
		Find(&resenas).Error
	if err != nil {
		writeError(w, http.StatusInternalServerError, "error obteniendo reseñas")
		return
	}

	responses := make([]resenaResponse, 0, len(resenas))
	for _, res := range resenas {
		responses = append(responses, toResenaResponse(res))
	}
	writeJSON(w, http.StatusOK, responses)
}

type moderarResenaRequest struct {
	Oculta bool `json:"oculta"`
}

// moderar — PATCH /resenas/{id} (admin, T4.5): body {"oculta": true|false}.
// Alterna la visibilidad sin borrar la fila.
func (h *resenaHandler) moderar(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "id inválido")
		return
	}

	var req moderarResenaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "cuerpo de la petición inválido")
		return
	}

	res := h.db.Model(&db.Resena{}).Where("id = ?", id).Update("oculta", req.Oculta)
	if res.Error != nil {
		writeError(w, http.StatusInternalServerError, "error actualizando la reseña")
		return
	}
	if res.RowsAffected == 0 {
		writeError(w, http.StatusNotFound, "reseña no encontrada")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// delete — DELETE /resenas/{id}, autenticado (2026-08-17, pedido del
// cliente: "que el cliente a las reseñas las pueda eliminar si quiere").
// Borrado real, no un soft-delete como moderar() — el WHERE incluye
// usuario_id, así que un usuario nunca puede borrar la reseña de otro ni
// aunque adivine el id: si no es el dueño, RowsAffected da 0 y responde
// 404 en vez de 403 (no hace falta distinguir "no existe" de "no es tuya"
// frente al cliente, y no filtra si el id pertenece a otra persona).
func (h *resenaHandler) delete(w http.ResponseWriter, r *http.Request) {
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

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "id inválido")
		return
	}

	res := h.db.Where("id = ? AND usuario_id = ?", id, usuarioID).Delete(&db.Resena{})
	if res.Error != nil {
		writeError(w, http.StatusInternalServerError, "error borrando la reseña")
		return
	}
	if res.RowsAffected == 0 {
		writeError(w, http.StatusNotFound, "reseña no encontrada")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

type crearResenaRequest struct {
	Rating int    `json:"rating"`
	Texto  string `json:"texto"`
}

// create — POST /alojamientos/{id}/resenas. Dos guardas antes de dejar
// escribir: (1) el usuario tiene que tener una reserva `confirmada` real
// de este alojamiento — no alcanza con "pendiente" ni con haber reservado
// otro distinto; (2) una reseña por usuario por alojamiento, no N.
func (h *resenaHandler) create(w http.ResponseWriter, r *http.Request) {
	claims, ok := claimsFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "falta el token de autenticación")
		return
	}
	// Mismo criterio que crear reserva (ver reservas.go): el admin no
	// interactúa como cliente, solo mira las páginas para verificar cambios.
	if claims.Rol == "administrador" {
		writeError(w, http.StatusForbidden, "una cuenta de administrador no puede dejar reseñas")
		return
	}
	usuarioID, err := uuid.Parse(claims.Subject)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "token inválido")
		return
	}

	alojamientoID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "id inválido")
		return
	}

	var req crearResenaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "cuerpo de la petición inválido")
		return
	}
	req.Texto = strings.TrimSpace(req.Texto)
	if req.Rating < 1 || req.Rating > 5 {
		writeError(w, http.StatusBadRequest, "el rating debe estar entre 1 y 5")
		return
	}
	if req.Texto == "" {
		writeError(w, http.StatusBadRequest, "el texto de la reseña es requerido")
		return
	}

	var reservasConfirmadas int64
	err = h.db.Model(&db.Reserva{}).
		Where("usuario_id = ? AND alojamiento_id = ? AND tipo = ? AND estado = ?",
			usuarioID, alojamientoID, "alojamiento", "confirmada").
		Count(&reservasConfirmadas).Error
	if err != nil {
		writeError(w, http.StatusInternalServerError, "error verificando tu reserva")
		return
	}
	if reservasConfirmadas == 0 {
		writeError(w, http.StatusForbidden,
			"necesitás una reserva confirmada de este alojamiento para dejar una reseña")
		return
	}

	var yaReseñado int64
	h.db.Model(&db.Resena{}).
		Where("usuario_id = ? AND alojamiento_id = ?", usuarioID, alojamientoID).
		Count(&yaReseñado)
	if yaReseñado > 0 {
		writeError(w, http.StatusConflict, "ya dejaste una reseña para este alojamiento")
		return
	}

	resena := db.Resena{
		UsuarioID:     usuarioID,
		AlojamientoID: &alojamientoID,
		Rating:        req.Rating,
		Texto:         req.Texto,
	}
	if err := h.db.Create(&resena).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "error creando la reseña")
		return
	}
	if err := h.db.Preload("Usuario").First(&resena, "id = ?", resena.ID).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "error obteniendo la reseña creada")
		return
	}

	writeJSON(w, http.StatusCreated, toResenaResponse(resena))
}
