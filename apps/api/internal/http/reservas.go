package http

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/mail"
	"regexp"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"

	"turismo-marcuzzi/api/internal/clock"
	"turismo-marcuzzi/api/internal/db"
	"turismo-marcuzzi/api/internal/email"
	"turismo-marcuzzi/api/internal/reservas"
)

// exclusionViolation es el SQLSTATE que Postgres devuelve cuando un
// INSERT choca contra un EXCLUDE USING gist — acá, el que evita reservas
// de alojamiento solapadas (spec §5, TR-005). No es un error de
// aplicación: es la garantía a nivel de base de datos haciendo su trabajo
// contra dos requests concurrentes (T3.1, riesgo R1 del plan).
const exclusionViolationCode = "23P01"

// registerReservaRoutes monta la creación de reservas de alojamiento
// (T3.1, FR-3/FR-7) y el historial del usuario (T3.2, alimenta el perfil
// T1.3). Todo detrás de requireAuth — cualquier usuario registrado puede
// reservar alojamiento sin la restricción de FR-11 (esa regla es solo
// para experiencias/servicio turístico/traslados, spec §4.7).
func registerReservaRoutes(r chi.Router, gdb *gorm.DB, jwtSecret string, sender email.Sender) {
	h := &reservaHandler{db: gdb, email: sender}

	r.Group(func(r chi.Router) {
		r.Use(requireAuth(jwtSecret))
		r.Post("/alojamientos/{id}/reservas", h.crear)
		r.Get("/me/reservas", h.misReservas)
		r.Post("/reservas/{id}/contacto", h.marcarContactado)
		// T4.6/FR-11: "¿tengo alojamiento confirmado vigente?" — endpoint
		// liviano (un bool) para el banner condicional de la home, en vez de
		// obligar al frontend a traer todo /me/reservas y recalcularlo ahí.
		r.Get("/me/alojamiento-vigente", h.alojamientoVigente)
	})

	// T4.4: listado y gestión de reservas entrantes — solo admin. Reutiliza
	// reservaHandler (mismo modelo, mismas respuestas) en vez de un handler
	// aparte.
	r.Group(func(r chi.Router) {
		r.Use(requireAuth(jwtSecret), requireRole("administrador"))
		r.Get("/reservas", h.listAdmin)
		r.Patch("/reservas/{id}/estado", h.actualizarEstado)
		r.Patch("/reservas/{id}", h.actualizarDatos)
	})
}

type reservaHandler struct {
	db    *gorm.DB
	email email.Sender
}

// crearReservaRequest — T3.5: además de las fechas, el formulario que se
// abre al reservar pide datos de contacto puntuales para esta reserva
// (no del perfil, ver comentario en db.Reserva). Todos requeridos: son
// justo los datos que el dueño necesita para cotejar el pago que le
// llega contra la reserva pendiente correcta.
type crearReservaRequest struct {
	FechaInicio      string `json:"fechaInicio"`
	FechaFin         string `json:"fechaFin"`
	ContactoNombre   string `json:"contactoNombre"`
	ContactoApellido string `json:"contactoApellido"`
	ContactoDNI      string `json:"contactoDni"`
	ContactoEmail    string `json:"contactoEmail"`
	ContactoTelefono string `json:"contactoTelefono"`
}

var dniRe = regexp.MustCompile(`^\d{6,9}$`)

func (req crearReservaRequest) validateContacto() string {
	if strings.TrimSpace(req.ContactoNombre) == "" {
		return "falta el nombre de contacto"
	}
	if strings.TrimSpace(req.ContactoApellido) == "" {
		return "falta el apellido de contacto"
	}
	if !dniRe.MatchString(strings.TrimSpace(req.ContactoDNI)) {
		return "el DNI debe tener entre 6 y 9 dígitos, sin puntos"
	}
	if _, err := mail.ParseAddress(req.ContactoEmail); err != nil {
		return "el email de contacto es inválido"
	}
	if strings.TrimSpace(req.ContactoTelefono) == "" {
		return "falta el teléfono de contacto"
	}
	return ""
}

type alojamientoResumen struct {
	ID      string  `json:"id"`
	Nombre  string  `json:"nombre"`
	FotoURL *string `json:"fotoUrl,omitempty"`
}

// usuarioResumen — quién hizo la reserva (T4.4): el admin necesita saber
// esto además de los datos de contacto puntuales (T3.5), que pueden ser de
// otra persona (alguien reservando para un tercero).
type usuarioResumen struct {
	ID     string `json:"id"`
	Nombre string `json:"nombre"`
	Email  string `json:"email"`
}

type reservaResponse struct {
	ID          string              `json:"id"`
	Tipo        string              `json:"tipo"`
	Estado      string              `json:"estado"`
	FechaInicio string              `json:"fechaInicio"`
	FechaFin    string              `json:"fechaFin"`
	Total       float64             `json:"total"`
	Alojamiento *alojamientoResumen `json:"alojamiento,omitempty"`
	// Usuario — solo se completa en el listado admin (T4.4, toReservaResponseAdmin).
	Usuario          *usuarioResumen `json:"usuario,omitempty"`
	ContactoNombre   string          `json:"contactoNombre"`
	ContactoApellido string          `json:"contactoApellido"`
	ContactoDNI      string          `json:"contactoDni"`
	ContactoEmail    string          `json:"contactoEmail"`
	ContactoTelefono string          `json:"contactoTelefono"`
	// ExpiraEn — el próximo vencimiento que le queda a la reserva, según en
	// qué fase esté (T3.7): CreatedAt+ContactoTTL si todavía no se marcó
	// contacto, o ContactadoEn+ConfirmacionTTL si ya se marcó. Vacío si no
	// está 'pendiente' (nada por vencer).
	ExpiraEn *string `json:"expiraEn,omitempty"`
	// Contactado — true si ya se registró el click de contacto (T3.6): el
	// frontend lo usa para elegir qué fase de aviso mostrar.
	Contactado bool `json:"contactado"`
	// Vigente — solo true si está 'confirmada' Y la estadía no terminó
	// todavía (fecha_fin >= hoy, FR-11/TR-007). Calculado acá con
	// clock.Today() a propósito: el frontend no tiene forma segura de
	// saber "hoy en Argentina" sin este dato (ver docs/CLAUDE.md).
	Vigente bool `json:"vigente"`
}

func toReservaResponse(res db.Reserva) reservaResponse {
	out := reservaResponse{
		ID:               res.ID.String(),
		Tipo:             res.Tipo,
		Estado:           res.Estado,
		Total:            res.Total,
		ContactoNombre:   res.ContactoNombre,
		ContactoApellido: res.ContactoApellido,
		ContactoDNI:      res.ContactoDNI,
		ContactoEmail:    res.ContactoEmail,
		ContactoTelefono: res.ContactoTelefono,
		Contactado:       res.ContactadoEn != nil,
	}
	if res.Estado == "pendiente" {
		if res.ContactadoEn != nil {
			expira := res.ContactadoEn.Add(reservas.ConfirmacionTTL).Format(time.RFC3339)
			out.ExpiraEn = &expira
		} else {
			expira := res.CreatedAt.Add(reservas.ContactoTTL).Format(time.RFC3339)
			out.ExpiraEn = &expira
		}
	}
	if res.Estado == "confirmada" && res.FechaFin != nil && !res.FechaFin.Before(clock.Today()) {
		out.Vigente = true
	}
	if res.FechaInicio != nil {
		out.FechaInicio = res.FechaInicio.Format(dateLayout)
	}
	if res.FechaFin != nil {
		out.FechaFin = res.FechaFin.Format(dateLayout)
	}
	if res.Alojamiento != nil {
		resumen := alojamientoResumen{ID: res.Alojamiento.ID.String(), Nombre: res.Alojamiento.Nombre}
		if len(res.Alojamiento.Fotos) > 0 {
			resumen.FotoURL = &res.Alojamiento.Fotos[0].URL
		}
		out.Alojamiento = &resumen
	}
	return out
}

// toReservaResponseAdmin — misma respuesta que toReservaResponse, más quién
// hizo la reserva (T4.4). Requiere que Usuario venga precargado (ver
// listAdmin) — a diferencia de Alojamiento, no es puntero en db.Reserva, así
// que no hay nil-check posible: si no se precargó, sale vacío en vez de
// entrar en pánico.
func toReservaResponseAdmin(res db.Reserva) reservaResponse {
	out := toReservaResponse(res)
	out.Usuario = &usuarioResumen{
		ID:     res.UsuarioID.String(),
		Nombre: res.Usuario.Nombre,
		Email:  res.Usuario.Email,
	}
	return out
}

// crear — POST /alojamientos/{id}/reservas. Intenta el INSERT directo y
// deja que el exclusion constraint decida si dos requests concurrentes
// piden el mismo rango (T3.1): no hay chequeo previo de disponibilidad en
// la app que pueda perder la carrera — eso es exactamente lo que TR-005
// existe para evitar.
func (h *reservaHandler) crear(w http.ResponseWriter, r *http.Request) {
	claims, ok := claimsFromContext(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "falta el token de autenticación")
		return
	}
	// El admin no reserva como si fuera un cliente (pedido del cliente,
	// 2026-08-13): su cuenta es para gestionar la operación desde el panel,
	// no para generar reservas reales que después haya que distinguir de
	// las de huéspedes de verdad. Defensa en profundidad — el frontend ya
	// oculta el botón de reservar para un admin (ver alojamiento/[id]/page.tsx).
	if claims.Rol == "administrador" {
		writeError(w, http.StatusForbidden, "una cuenta de administrador no puede reservar como cliente")
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

	var alojamiento db.Alojamiento
	if err := h.db.First(&alojamiento, "id = ? AND activo = ?", alojamientoID, true).Error; err != nil {
		writeError(w, http.StatusNotFound, "alojamiento no encontrado")
		return
	}

	var req crearReservaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "cuerpo de la petición inválido")
		return
	}
	if msg := req.validateContacto(); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}

	// clock.ParseDate, no time.Parse: hay que comparar contra clock.Today()
	// en la misma zona horaria o la comparación se corre (bug real,
	// encontrado 2026-08-12 — ver comentario en clock.ParseDate).
	inicio, err1 := clock.ParseDate(req.FechaInicio)
	fin, err2 := clock.ParseDate(req.FechaFin)
	if err1 != nil || err2 != nil {
		writeError(w, http.StatusBadRequest, "fechas inválidas")
		return
	}
	// Al menos un día de anticipación (decisión del cliente, 2026-08-12):
	// no alcanza con "no en el pasado", hoy mismo tampoco se puede reservar.
	minimo := clock.Today().AddDate(0, 0, 1)
	if inicio.Before(minimo) {
		writeError(w, http.StatusBadRequest,
			"las reservas necesitan al menos un día de anticipación — elegí una fecha de check-in a partir de mañana")
		return
	}
	if !fin.After(inicio) {
		writeError(w, http.StatusBadRequest, "el check-out debe ser posterior al check-in")
		return
	}

	noches := int(fin.Sub(inicio).Hours() / 24)
	total := float64(noches) * alojamiento.PrecioNoche

	reserva := db.Reserva{
		UsuarioID:        usuarioID,
		AlojamientoID:    &alojamientoID,
		Tipo:             "alojamiento",
		Estado:           "pendiente",
		FechaInicio:      &inicio,
		FechaFin:         &fin,
		Total:            total,
		ContactoNombre:   strings.TrimSpace(req.ContactoNombre),
		ContactoApellido: strings.TrimSpace(req.ContactoApellido),
		ContactoDNI:      strings.TrimSpace(req.ContactoDNI),
		ContactoEmail:    strings.TrimSpace(req.ContactoEmail),
		ContactoTelefono: strings.TrimSpace(req.ContactoTelefono),
	}

	if err := h.db.Create(&reserva).Error; err != nil {
		if isExclusionViolation(err) {
			writeError(w, http.StatusConflict,
				"esas fechas ya no están disponibles — alguien más las reservó justo antes. Probá otro rango.")
			return
		}
		writeError(w, http.StatusInternalServerError, "error creando la reserva")
		return
	}

	// Email "recibimos tu reserva" (T3.3) — best-effort: si falla, no
	// tira abajo la respuesta, la reserva ya quedó creada. Se usa
	// context.Background() a propósito, no r.Context(): este envío puede
	// terminar después de que la response ya se mandó.
	h.sendConfirmacion(reserva, alojamiento)

	writeJSON(w, http.StatusCreated, toReservaResponse(reserva))
}

func (h *reservaHandler) sendConfirmacion(reserva db.Reserva, alojamiento db.Alojamiento) {
	var usuario db.Usuario
	if err := h.db.First(&usuario, "id = ?", reserva.UsuarioID).Error; err != nil {
		return
	}

	asunto := fmt.Sprintf("Recibimos tu reserva — %s", alojamiento.Nombre)
	cuerpo := fmt.Sprintf(
		"Hola %s,\n\nRecibimos tu solicitud de reserva para %s del %s al %s (%d noches, total %.2f ARS).\n\n"+
			"Tu reserva queda en estado pendiente hasta que coordinemos el pago directamente y la confirmemos — "+
			"nos contactamos con vos a la brevedad.\n\nTurismo Marcuzzi",
		usuario.Nombre, alojamiento.Nombre,
		reserva.FechaInicio.Format(dateLayout), reserva.FechaFin.Format(dateLayout),
		int(reserva.FechaFin.Sub(*reserva.FechaInicio).Hours()/24), reserva.Total,
	)

	if err := h.email.Send(context.Background(), usuario.Email, asunto, cuerpo); err != nil {
		// No hay nada más razonable que hacer acá que loguearlo: la
		// reserva ya está creada y es la fuente de verdad, no el email.
		fmt.Printf("error enviando email de confirmación de reserva %s: %v\n", reserva.ID, err)
	}
}

// misReservas — GET /me/reservas: historial del usuario logueado (T3.2),
// consumido por /perfil (T1.3) en el frontend.
func (h *reservaHandler) misReservas(w http.ResponseWriter, r *http.Request) {
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

	var misReservas []db.Reserva
	err = h.db.
		Preload("Alojamiento", func(tx *gorm.DB) *gorm.DB { return tx }).
		Preload("Alojamiento.Fotos", preloadFotos).
		// es_bloqueo_admin = false: un bloqueo manual de fechas (T4.3) es una
		// fila de reservas con usuario_id = el admin que lo creó — si ese
		// mismo admin tiene su propio perfil de cliente, no debería ver sus
		// propios bloqueos mezclados con reservas reales acá.
		Where("usuario_id = ? AND es_bloqueo_admin = ?", usuarioID, false).
		Order("fecha_inicio desc").
		Find(&misReservas).Error
	if err != nil {
		writeError(w, http.StatusInternalServerError, "error obteniendo tus reservas")
		return
	}

	responses := make([]reservaResponse, 0, len(misReservas))
	for _, res := range misReservas {
		responses = append(responses, toReservaResponse(res))
	}
	writeJSON(w, http.StatusOK, responses)
}

// marcarContactado — POST /reservas/{id}/contacto (T3.6). Se llama cuando
// el usuario toca el botón de WhatsApp/mail después de reservar: apaga el
// vencimiento de 20 minutos (ver internal/reservas.ExpirePendientes) sin
// tocar el estado — sigue 'pendiente' hasta que el admin la confirme,
// pero ya no corre riesgo de cancelarse sola. Idempotente: tocar el botón
// dos veces no hace nada raro, solo reafirma `contactado_en`.
func (h *reservaHandler) marcarContactado(w http.ResponseWriter, r *http.Request) {
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

	reservaID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "id inválido")
		return
	}

	now := time.Now()
	// El WHERE por usuario_id además de id es la protección real: sin él,
	// cualquier usuario logueado podría apagar el timer de la reserva de
	// otro adivinando su id.
	res := h.db.Model(&db.Reserva{}).
		Where("id = ? AND usuario_id = ?", reservaID, usuarioID).
		Update("contactado_en", now)
	if res.Error != nil {
		writeError(w, http.StatusInternalServerError, "error registrando el contacto")
		return
	}
	if res.RowsAffected == 0 {
		writeError(w, http.StatusNotFound, "reserva no encontrada")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// alojamientoVigente — GET /me/alojamiento-vigente (T4.6, FR-11). Devuelve
// {"vigente": true} solo si el usuario tiene una reserva de alojamiento
// confirmada cuya estadía no terminó todavía (fecha_fin >= hoy). La home
// (T4.6) usa esto para el banner condicional; experiencias/servicio
// turístico/traslados (Fase 2) van a usar el mismo endpoint para habilitar
// o no el botón de reserva.
func (h *reservaHandler) alojamientoVigente(w http.ResponseWriter, r *http.Request) {
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

	var count int64
	err = h.db.Model(&db.Reserva{}).
		Where(`usuario_id = ? AND tipo = ? AND estado = ? AND es_bloqueo_admin = ? AND fecha_fin >= ?`,
			usuarioID, "alojamiento", "confirmada", false, clock.Today()).
		Count(&count).Error
	if err != nil {
		writeError(w, http.StatusInternalServerError, "error verificando tu alojamiento")
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"vigente": count > 0})
}

// listAdmin — GET /reservas (admin, T4.4): todas las reservas de clientes
// reales (es_bloqueo_admin = false — los bloqueos manuales de fechas, T4.3,
// se gestionan aparte en bloqueos.go). Filtro opcional ?estado=pendiente
// para la vista por defecto del panel (lo que el admin necesita accionar
// primero). Ordenadas con las pendientes arriba: son las que requieren
// acción; confirmadas/canceladas son solo historial.
func (h *reservaHandler) listAdmin(w http.ResponseWriter, r *http.Request) {
	query := h.db.
		Preload("Usuario").
		Preload("Alojamiento", func(tx *gorm.DB) *gorm.DB { return tx }).
		Preload("Alojamiento.Fotos", preloadFotos).
		Where("es_bloqueo_admin = ?", false)

	if estado := r.URL.Query().Get("estado"); estado != "" {
		query = query.Where("estado = ?", estado)
	}

	var todas []db.Reserva
	err := query.
		Order(`CASE estado WHEN 'pendiente' THEN 0 WHEN 'confirmada' THEN 1 ELSE 2 END, created_at desc`).
		Find(&todas).Error
	if err != nil {
		writeError(w, http.StatusInternalServerError, "error obteniendo las reservas")
		return
	}

	responses := make([]reservaResponse, 0, len(todas))
	for _, res := range todas {
		responses = append(responses, toReservaResponseAdmin(res))
	}
	writeJSON(w, http.StatusOK, responses)
}

type actualizarEstadoRequest struct {
	Estado string `json:"estado"`
}

// actualizarEstado — PATCH /reservas/{id}/estado (admin, T4.4): la acción
// central del panel — confirmar (una vez coordinado el pago fuera de la
// plataforma, spec §4.7) o cancelar una reserva pendiente. No es un PUT
// genérico a propósito: solo se puede tocar el estado desde acá, nada más
// del contenido de la reserva es editable después de creada.
//
// Transiciones permitidas: pendiente→confirmada, pendiente→cancelada,
// confirmada→cancelada (una cancelación tardía, p. ej. el huésped avisa que
// no viene). 'cancelada' es terminal — no se puede reabrir ni re-confirmar
// desde acá (evita reactivar una reserva vieja que ya perdió su lugar
// contra el exclusion constraint de forma confusa).
func (h *reservaHandler) actualizarEstado(w http.ResponseWriter, r *http.Request) {
	reservaID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "id inválido")
		return
	}

	var req actualizarEstadoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "cuerpo de la petición inválido")
		return
	}
	if req.Estado != "confirmada" && req.Estado != "cancelada" {
		writeError(w, http.StatusBadRequest, "estado debe ser 'confirmada' o 'cancelada'")
		return
	}

	var reserva db.Reserva
	err = h.db.Preload("Alojamiento").First(&reserva, "id = ? AND es_bloqueo_admin = ?", reservaID, false).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		writeError(w, http.StatusNotFound, "reserva no encontrada")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "error obteniendo la reserva")
		return
	}
	if reserva.Estado == "cancelada" {
		writeError(w, http.StatusConflict, "esta reserva ya está cancelada, no se puede modificar")
		return
	}
	if reserva.Estado == req.Estado {
		writeError(w, http.StatusConflict, "la reserva ya está en ese estado")
		return
	}

	if err := h.db.Model(&reserva).Update("estado", req.Estado).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "error actualizando la reserva")
		return
	}
	reserva.Estado = req.Estado

	if req.Estado == "confirmada" {
		h.sendConfirmada(reserva)
	}

	writeJSON(w, http.StatusOK, toReservaResponse(reserva))
}

// actualizarDatos — PATCH /reservas/{id} (admin, T4.13): editar fechas y
// contacto de una reserva pendiente/confirmada, para corregir un error de
// carga o un imprevisto de último momento sin tener que cancelarla y que
// el cliente vuelva a hacer todo el flujo desde cero. No se puede editar
// una cancelada (ya no representa nada activo) ni un bloqueo manual (se
// gestiona aparte, ver bloqueos.go). Las fechas nuevas vuelven a chocar
// contra el exclusion constraint si se solapan con otra reserva/bloqueo —
// la garantía de TR-005 sigue aplicando en un UPDATE igual que en un
// INSERT. A diferencia de crear() (T3.1), no exige un día de
// anticipación: el admin puede necesitar corregir una fecha que ya pasó
// el corte normal.
func (h *reservaHandler) actualizarDatos(w http.ResponseWriter, r *http.Request) {
	reservaID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "id inválido")
		return
	}

	var reserva db.Reserva
	err = h.db.Preload("Alojamiento").First(&reserva, "id = ? AND es_bloqueo_admin = ?", reservaID, false).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		writeError(w, http.StatusNotFound, "reserva no encontrada")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "error obteniendo la reserva")
		return
	}
	if reserva.Estado == "cancelada" {
		writeError(w, http.StatusConflict, "no se puede editar una reserva cancelada")
		return
	}

	var req crearReservaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "cuerpo de la petición inválido")
		return
	}
	if msg := req.validateContacto(); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}

	inicio, err1 := clock.ParseDate(req.FechaInicio)
	fin, err2 := clock.ParseDate(req.FechaFin)
	if err1 != nil || err2 != nil {
		writeError(w, http.StatusBadRequest, "fechas inválidas")
		return
	}
	if !fin.After(inicio) {
		writeError(w, http.StatusBadRequest, "el check-out debe ser posterior al check-in")
		return
	}

	noches := int(fin.Sub(inicio).Hours() / 24)
	total := float64(noches) * reserva.Alojamiento.PrecioNoche

	cambios := map[string]any{
		"fecha_inicio":      inicio,
		"fecha_fin":         fin,
		"total":             total,
		"contacto_nombre":   strings.TrimSpace(req.ContactoNombre),
		"contacto_apellido": strings.TrimSpace(req.ContactoApellido),
		"contacto_dni":      strings.TrimSpace(req.ContactoDNI),
		"contacto_email":    strings.TrimSpace(req.ContactoEmail),
		"contacto_telefono": strings.TrimSpace(req.ContactoTelefono),
	}
	if err := h.db.Model(&db.Reserva{}).Where("id = ?", reserva.ID).Updates(cambios).Error; err != nil {
		if isExclusionViolation(err) {
			writeError(w, http.StatusConflict, "esas fechas se superponen con otra reserva o bloqueo existente")
			return
		}
		writeError(w, http.StatusInternalServerError, "error actualizando la reserva")
		return
	}

	if err := h.db.Preload("Alojamiento").First(&reserva, "id = ?", reserva.ID).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "error obteniendo la reserva actualizada")
		return
	}
	writeJSON(w, http.StatusOK, toReservaResponse(reserva))
}

// sendConfirmada — email "tu reserva fue confirmada" (T4.4/T4.6): dispara
// justo cuando el admin confirma desde el panel, que es también el momento
// en que FR-11 desbloquea servicios para este usuario (T4.6) — best-effort,
// mismo criterio que sendConfirmacion (T3.3).
func (h *reservaHandler) sendConfirmada(reserva db.Reserva) {
	var usuario db.Usuario
	if err := h.db.First(&usuario, "id = ?", reserva.UsuarioID).Error; err != nil {
		return
	}

	nombreAlojamiento := "tu alojamiento"
	if reserva.Alojamiento != nil {
		nombreAlojamiento = reserva.Alojamiento.Nombre
	}

	asunto := fmt.Sprintf("¡Tu reserva fue confirmada! — %s", nombreAlojamiento)
	cuerpo := fmt.Sprintf(
		"Hola %s,\n\nTu reserva de %s del %s al %s quedó confirmada.\n\n"+
			"Ya podés ver el resto de nuestros servicios (experiencias, servicio turístico y traslados) desde la home.\n\n"+
			"Turismo Marcuzzi",
		usuario.Nombre, nombreAlojamiento,
		reserva.FechaInicio.Format(dateLayout), reserva.FechaFin.Format(dateLayout),
	)

	if err := h.email.Send(context.Background(), usuario.Email, asunto, cuerpo); err != nil {
		fmt.Printf("error enviando email de confirmación de reserva %s: %v\n", reserva.ID, err)
	}
}

func isExclusionViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == exclusionViolationCode
}
