package http

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"turismo-marcuzzi/api/internal/clock"
	"turismo-marcuzzi/api/internal/db"
)

// registerBloqueoRoutes monta la gestión de bloqueos manuales de fechas
// (T4.3, spec §4.8 "gestión de disponibilidad") — todo admin-only. Un
// bloqueo es una fila de `reservas` con EsBloqueoAdmin=true (ver comentario
// en db.Reserva/TR-019): no hay tabla ni exclusion constraint nuevos, esto
// reutiliza el mismo mecanismo que ya impide reservas de alojamiento
// solapadas, así que un bloqueo tampoco puede solaparse con una reserva
// real ni con otro bloqueo — gratis, sin duplicar la garantía.
//
// No hay endpoint público: GET /alojamientos/{id}/disponibilidad (T2.5) ya
// devuelve los bloqueos como rangos "ocupado" sin cambios, porque consulta
// "cualquier reserva activa" sin distinguir el flag — el calendario del
// frontend los bloquea igual que una reserva real, que es exactamente el
// efecto buscado.
func registerBloqueoRoutes(r chi.Router, gdb *gorm.DB, jwtSecret string) {
	h := &bloqueoHandler{db: gdb}

	r.Group(func(r chi.Router) {
		r.Use(requireAuth(jwtSecret), requireRole("administrador"))
		r.Get("/alojamientos/{id}/bloqueos", h.list)
		r.Post("/alojamientos/{id}/bloqueos", h.create)
		r.Delete("/alojamientos/{id}/bloqueos/{bloqueoId}", h.delete)
	})
}

type bloqueoHandler struct {
	db *gorm.DB
}

type bloqueoResponse struct {
	ID          string `json:"id"`
	FechaInicio string `json:"fechaInicio"`
	FechaFin    string `json:"fechaFin"`
	Motivo      string `json:"motivo"`
}

func toBloqueoResponse(res db.Reserva) bloqueoResponse {
	out := bloqueoResponse{ID: res.ID.String(), Motivo: res.BloqueoMotivo}
	if res.FechaInicio != nil {
		out.FechaInicio = res.FechaInicio.Format(dateLayout)
	}
	if res.FechaFin != nil {
		out.FechaFin = res.FechaFin.Format(dateLayout)
	}
	return out
}

// list — GET /alojamientos/{id}/bloqueos: bloqueos vigentes (no vencidos,
// no cancelados) de este alojamiento, para que el panel los liste con
// opción de liberar cada uno.
func (h *bloqueoHandler) list(w http.ResponseWriter, r *http.Request) {
	alojamientoID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "id inválido")
		return
	}

	var bloqueos []db.Reserva
	err = h.db.
		Where("alojamiento_id = ? AND es_bloqueo_admin = ? AND estado <> ? AND fecha_fin >= ?",
			alojamientoID, true, "cancelada", clock.Today()).
		Order("fecha_inicio asc").
		Find(&bloqueos).Error
	if err != nil {
		writeError(w, http.StatusInternalServerError, "error obteniendo los bloqueos")
		return
	}

	responses := make([]bloqueoResponse, 0, len(bloqueos))
	for _, b := range bloqueos {
		responses = append(responses, toBloqueoResponse(b))
	}
	writeJSON(w, http.StatusOK, responses)
}

type crearBloqueoRequest struct {
	FechaInicio string `json:"fechaInicio"`
	FechaFin    string `json:"fechaFin"`
	Motivo      string `json:"motivo"`
}

// create — POST /alojamientos/{id}/bloqueos. A diferencia de crear reserva
// (T3.1), no exige un día de anticipación (el admin puede bloquear hoy
// mismo, p. ej. por mantenimiento) — solo que el rango sea válido. El
// INSERT choca contra el mismo exclusion constraint que protege reservas
// reales si se solapa con algo ya ocupado.
func (h *bloqueoHandler) create(w http.ResponseWriter, r *http.Request) {
	claims, ok := claimsFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "falta el token de autenticación")
		return
	}
	adminID, err := uuid.Parse(claims.Subject)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "token inválido")
		return
	}

	alojamientoID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "id inválido")
		return
	}
	var count int64
	if err := h.db.Model(&db.Alojamiento{}).Where("id = ?", alojamientoID).Count(&count).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "error verificando el alojamiento")
		return
	}
	if count == 0 {
		writeError(w, http.StatusNotFound, "alojamiento no encontrado")
		return
	}

	var req crearBloqueoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "cuerpo de la petición inválido")
		return
	}

	inicio, err1 := clock.ParseDate(req.FechaInicio)
	fin, err2 := clock.ParseDate(req.FechaFin)
	if err1 != nil || err2 != nil {
		writeError(w, http.StatusBadRequest, "fechas inválidas")
		return
	}
	if !fin.After(inicio) {
		writeError(w, http.StatusBadRequest, "la fecha de fin debe ser posterior a la de inicio")
		return
	}

	bloqueo := db.Reserva{
		UsuarioID:      adminID,
		AlojamientoID:  &alojamientoID,
		Tipo:           "alojamiento",
		Estado:         "confirmada",
		FechaInicio:    &inicio,
		FechaFin:       &fin,
		EsBloqueoAdmin: true,
		BloqueoMotivo:  req.Motivo,
	}
	if err := h.db.Create(&bloqueo).Error; err != nil {
		if isExclusionViolation(err) {
			writeError(w, http.StatusConflict, "esas fechas se superponen con una reserva o un bloqueo existente")
			return
		}
		writeError(w, http.StatusInternalServerError, "error creando el bloqueo")
		return
	}

	writeJSON(w, http.StatusCreated, toBloqueoResponse(bloqueo))
}

// delete — DELETE /alojamientos/{id}/bloqueos/{bloqueoId}: libera el rango
// (soft: pasa a 'cancelada', mismo criterio que dar de baja un alojamiento
// — nunca se borra la fila) para que vuelva a estar disponible.
func (h *bloqueoHandler) delete(w http.ResponseWriter, r *http.Request) {
	alojamientoID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "id inválido")
		return
	}
	bloqueoID, err := uuid.Parse(chi.URLParam(r, "bloqueoId"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "id de bloqueo inválido")
		return
	}

	res := h.db.Model(&db.Reserva{}).
		Where("id = ? AND alojamiento_id = ? AND es_bloqueo_admin = ?", bloqueoID, alojamientoID, true).
		Update("estado", "cancelada")
	if res.Error != nil {
		writeError(w, http.StatusInternalServerError, "error liberando el bloqueo")
		return
	}
	if res.RowsAffected == 0 {
		writeError(w, http.StatusNotFound, "bloqueo no encontrado")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
