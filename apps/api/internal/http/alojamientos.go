package http

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"turismo-marcuzzi/api/internal/clock"
	"turismo-marcuzzi/api/internal/db"
	"turismo-marcuzzi/api/internal/storage"
)

const (
	// Límites separados (T4.17, pedido del cliente 2026-08-13: "que se
	// puedan subir videos con mayor tamaño") — antes eran un solo
	// `maxUploadBytes` de 60MB compartido, insuficiente para un video de
	// varios minutos en buena calidad. Foto se queda en un tope chico
	// (spec §7 pide performance de imágenes, no tiene sentido aceptar una
	// foto de cientos de MB sin comprimir); video sube a 300MB.
	maxImageUploadBytes = 15 << 20
	maxVideoUploadBytes = 300 << 20
	dateLayout          = "2006-01-02"
)

var allowedImageTypes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
}

// allowedVideoTypes (T4.13) — recorridos cortos del alojamiento junto a
// las fotos en la misma galería (mismo mecanismo de carga/orden/borrado,
// ver db.Foto.Tipo).
var allowedVideoTypes = map[string]bool{
	"video/mp4":       true,
	"video/webm":      true,
	"video/quicktime": true, // .mov
}

// registerAlojamientoRoutes monta el CRUD de alojamiento (T2.1, FR-2/FR-3/
// FR-8). Lectura (listado, detalle, disponibilidad) es pública — spec §4.2
// no pide login para ver alojamientos. Escritura (crear/editar/dar de baja,
// fotos) queda detrás de requireAuth + requireRole("administrador"): no hay
// panel admin todavía (Sprint 4), pero la API ya tiene que estar protegida.
func registerAlojamientoRoutes(r chi.Router, gdb *gorm.DB, jwtSecret string, store storage.Storage) {
	h := &alojamientoHandler{db: gdb, storage: store, jwtSecret: jwtSecret}

	r.Get("/alojamientos", h.list)
	r.Get("/alojamientos/{id}", h.get)
	r.Get("/alojamientos/{id}/disponibilidad", h.disponibilidad)

	r.Group(func(r chi.Router) {
		r.Use(requireAuth(jwtSecret), requireRole("administrador"))
		r.Post("/alojamientos", h.create)
		r.Put("/alojamientos/{id}", h.update)
		r.Delete("/alojamientos/{id}", h.deactivate)
		r.Post("/alojamientos/{id}/activar", h.activate)
		r.Post("/alojamientos/{id}/fotos", h.uploadFoto)
		r.Delete("/alojamientos/{id}/fotos/{fotoId}", h.deleteFoto)
		r.Post("/alojamientos/{id}/portada", h.uploadPortada)
	})
}

type alojamientoHandler struct {
	db        *gorm.DB
	storage   storage.Storage
	jwtSecret string
}

type fotoResponse struct {
	ID    string `json:"id"`
	URL   string `json:"url"`
	Orden int    `json:"orden"`
	// Tipo: "foto" | "video" (T4.13) — el frontend decide si renderiza
	// <Image> o <video> según esto.
	Tipo string `json:"tipo"`
	// EsPortada (T4.14) — la miniatura del listado de Alojamiento, distinta
	// de la galería del detalle.
	EsPortada bool `json:"esPortada"`
}

type alojamientoResponse struct {
	ID             string         `json:"id"`
	Nombre         string         `json:"nombre"`
	Descripcion    string         `json:"descripcion"`
	Lat            float64        `json:"lat"`
	Lng            float64        `json:"lng"`
	Direccion      string         `json:"direccion"`
	PrecioNoche    float64        `json:"precioNoche"`
	Capacidad      int            `json:"capacidad"`
	Activo         bool           `json:"activo"`
	Fotos          []fotoResponse `json:"fotos"`
	RatingPromedio *float64       `json:"ratingPromedio,omitempty"`
	TotalResenas   int            `json:"totalResenas"`
}

func toFotoResponse(f db.Foto) fotoResponse {
	return fotoResponse{ID: f.ID.String(), URL: f.URL, Orden: f.Orden, Tipo: f.Tipo, EsPortada: f.EsPortada}
}

// toAlojamientoResponse no incluye rating — usar toAlojamientoResponseCon
// cuando haya un ratingAgg a mano (T3.4). Separado en dos funciones para
// no forzar a cada caller a pasar un mapa vacío cuando no le importa.
func toAlojamientoResponse(a db.Alojamiento) alojamientoResponse {
	return toAlojamientoResponseCon(a, ratingAgg{})
}

func toAlojamientoResponseCon(a db.Alojamiento, rating ratingAgg) alojamientoResponse {
	fotos := make([]fotoResponse, 0, len(a.Fotos))
	for _, f := range a.Fotos {
		fotos = append(fotos, toFotoResponse(f))
	}
	resp := alojamientoResponse{
		ID:           a.ID.String(),
		Nombre:       a.Nombre,
		Descripcion:  a.Descripcion,
		Lat:          a.Lat,
		Lng:          a.Lng,
		Direccion:    a.Direccion,
		PrecioNoche:  a.PrecioNoche,
		Capacidad:    a.Capacidad,
		Activo:       a.Activo,
		Fotos:        fotos,
		TotalResenas: rating.Total,
	}
	if rating.Total > 0 {
		resp.RatingPromedio = &rating.Promedio
	}
	return resp
}

func preloadFotos(tx *gorm.DB) *gorm.DB {
	return tx.Order("orden asc")
}

// ratingAgg — promedio y cantidad de reseñas de un alojamiento (T3.4).
type ratingAgg struct {
	Promedio float64
	Total    int
}

// loadRatings trae el promedio/cantidad de reseñas de varios alojamientos
// de una sola consulta agrupada, en vez de una por tarjeta (evita N+1 en
// el listado).
func loadRatings(gdb *gorm.DB, ids []uuid.UUID) (map[uuid.UUID]ratingAgg, error) {
	result := make(map[uuid.UUID]ratingAgg, len(ids))
	if len(ids) == 0 {
		return result, nil
	}

	var rows []struct {
		AlojamientoID uuid.UUID
		Promedio      float64
		Total         int
	}
	// oculta = false: una reseña moderada (T4.5) no debe seguir pesando en
	// el promedio que ve el público, aunque siga en la base.
	err := gdb.Model(&db.Resena{}).
		Select("alojamiento_id, AVG(rating) AS promedio, COUNT(*) AS total").
		Where("alojamiento_id IN ? AND oculta = ?", ids, false).
		Group("alojamiento_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	for _, row := range rows {
		result[row.AlojamientoID] = ratingAgg{Promedio: row.Promedio, Total: row.Total}
	}
	return result, nil
}

// list — GET /alojamientos. Filtros opcionales por query string (T2.2):
// huespedes, precio_min, precio_max, fecha_inicio+fecha_fin (deben ir
// juntas). El filtro de fechas excluye alojamientos con una reserva activa
// que se solape con el rango pedido, usando la misma columna generada
// `rango_fechas`/operador `&&` que ya protege el exclusion constraint
// (spec §5) — no reinventa la lógica de solapamiento.
func (h *alojamientoHandler) list(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	query := h.db.Model(&db.Alojamiento{}).Preload("Fotos", preloadFotos)

	// incluirInactivos: solo tiene efecto para un caller admin autenticado
	// (T4.2, panel) — un alojamiento dado de baja (activo=false) sigue sin
	// aparecer en el listado público normal.
	if q.Get("incluirInactivos") != "true" || !isAdminCaller(r, h.jwtSecret) {
		query = query.Where("activo = ?", true)
	}

	if v := q.Get("huespedes"); v != "" {
		huespedes, err := strconv.Atoi(v)
		if err != nil || huespedes < 1 {
			writeError(w, http.StatusBadRequest, "huespedes inválido")
			return
		}
		query = query.Where("capacidad >= ?", huespedes)
	}

	if v := q.Get("precio_min"); v != "" {
		precioMin, err := strconv.ParseFloat(v, 64)
		if err != nil || precioMin < 0 {
			writeError(w, http.StatusBadRequest, "precio_min inválido")
			return
		}
		query = query.Where("precio_noche >= ?", precioMin)
	}

	if v := q.Get("precio_max"); v != "" {
		precioMax, err := strconv.ParseFloat(v, 64)
		if err != nil || precioMax < 0 {
			writeError(w, http.StatusBadRequest, "precio_max inválido")
			return
		}
		query = query.Where("precio_noche <= ?", precioMax)
	}

	fechaInicio, fechaFin := q.Get("fecha_inicio"), q.Get("fecha_fin")
	if (fechaInicio == "") != (fechaFin == "") {
		writeError(w, http.StatusBadRequest, "fecha_inicio y fecha_fin deben enviarse juntas")
		return
	}
	if fechaInicio != "" && fechaFin != "" {
		start, err1 := time.Parse(dateLayout, fechaInicio)
		end, err2 := time.Parse(dateLayout, fechaFin)
		if err1 != nil || err2 != nil || !end.After(start) {
			writeError(w, http.StatusBadRequest, "rango de fechas inválido")
			return
		}
		query = query.Where(`id NOT IN (
			SELECT alojamiento_id FROM reservas
			WHERE alojamiento_id IS NOT NULL
			  AND estado <> 'cancelada'
			  AND rango_fechas && daterange(?, ?, '[]')
		)`, fechaInicio, fechaFin)
	}

	var alojamientos []db.Alojamiento
	if err := query.Order("created_at desc").Find(&alojamientos).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "error listando alojamientos")
		return
	}

	ids := make([]uuid.UUID, len(alojamientos))
	for i, a := range alojamientos {
		ids[i] = a.ID
	}
	ratings, err := loadRatings(h.db, ids)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "error obteniendo calificaciones")
		return
	}

	responses := make([]alojamientoResponse, 0, len(alojamientos))
	for _, a := range alojamientos {
		responses = append(responses, toAlojamientoResponseCon(a, ratings[a.ID]))
	}
	writeJSON(w, http.StatusOK, responses)
}

func (h *alojamientoHandler) get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "id inválido")
		return
	}

	var alojamiento db.Alojamiento
	err = h.db.Preload("Fotos", preloadFotos).First(&alojamiento, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		writeError(w, http.StatusNotFound, "alojamiento no encontrado")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "error obteniendo el alojamiento")
		return
	}

	ratings, err := loadRatings(h.db, []uuid.UUID{alojamiento.ID})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "error obteniendo calificaciones")
		return
	}

	writeJSON(w, http.StatusOK, toAlojamientoResponseCon(alojamiento, ratings[alojamiento.ID]))
}

// disponibilidad — GET /alojamientos/{id}/disponibilidad: rangos ocupados
// (reservas activas, no vencidas) para que el calendario del frontend
// (T2.5) bloquee esas fechas. Usa clock.Today(), no time.Now(), para no
// mostrar como "libres" reservas que vencieron hoy mismo en otra zona
// horaria (mismo criterio que FR-11, ver docs/CLAUDE.md).
func (h *alojamientoHandler) disponibilidad(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "id inválido")
		return
	}

	var reservas []db.Reserva
	err = h.db.
		Where("alojamiento_id = ? AND estado <> ? AND fecha_fin >= ?", id, "cancelada", clock.Today()).
		Order("fecha_inicio asc").
		Find(&reservas).Error
	if err != nil {
		writeError(w, http.StatusInternalServerError, "error obteniendo disponibilidad")
		return
	}

	type rango struct {
		Inicio string `json:"inicio"`
		Fin    string `json:"fin"`
	}
	ocupado := make([]rango, 0, len(reservas))
	for _, res := range reservas {
		if res.FechaInicio == nil || res.FechaFin == nil {
			continue
		}
		ocupado = append(ocupado, rango{
			Inicio: res.FechaInicio.Format(dateLayout),
			Fin:    res.FechaFin.Format(dateLayout),
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{"ocupado": ocupado})
}

type alojamientoRequest struct {
	Nombre      string  `json:"nombre"`
	Descripcion string  `json:"descripcion"`
	Lat         float64 `json:"lat"`
	Lng         float64 `json:"lng"`
	Direccion   string  `json:"direccion"`
	PrecioNoche float64 `json:"precioNoche"`
	Capacidad   int     `json:"capacidad"`
	// Borrador (T4.19, pedido del cliente 2026-08-13): solo se lee en
	// create(), nunca en update() — "crear" desde el panel arma un
	// alojamiento con datos de relleno y Activo=false, y lo publica recién
	// cuando el admin lo activa a propósito (POST .../activar) desde su
	// propia página en modo editor, después de cargar los datos reales y
	// las fotos. Así nunca aparece un cartel a medio completar en el
	// listado público (spec §4.7 ya trata "de baja" = no público).
	Borrador bool `json:"borrador,omitempty"`
}

func (req alojamientoRequest) validate() string {
	if strings.TrimSpace(req.Nombre) == "" {
		return "nombre es requerido"
	}
	if req.Capacidad < 1 {
		return "capacidad debe ser al menos 1"
	}
	if req.PrecioNoche <= 0 {
		return "precioNoche debe ser mayor a 0"
	}
	if req.Lat < -90 || req.Lat > 90 {
		return "lat fuera de rango"
	}
	if req.Lng < -180 || req.Lng > 180 {
		return "lng fuera de rango"
	}
	return ""
}

func (h *alojamientoHandler) create(w http.ResponseWriter, r *http.Request) {
	var req alojamientoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "cuerpo de la petición inválido")
		return
	}
	if msg := req.validate(); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}

	alojamiento := db.Alojamiento{
		Nombre:      strings.TrimSpace(req.Nombre),
		Descripcion: req.Descripcion,
		Lat:         req.Lat,
		Lng:         req.Lng,
		Direccion:   req.Direccion,
		PrecioNoche: req.PrecioNoche,
		Capacidad:   req.Capacidad,
		Activo:      !req.Borrador,
	}
	if err := h.db.Create(&alojamiento).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "error creando el alojamiento")
		return
	}

	// GORM ignora un `false` explícito en Create() cuando la columna tiene
	// `gorm:"default:true"` (db.Alojamiento.Activo) — no distingue "no
	// seteado" de "seteado a false" en un bool no-puntero, así que el
	// INSERT queda con activo=true sin importar el valor de arriba
	// (confirmado con test manual). Update() sí lo fuerza sin ese
	// problema — mismo mecanismo que ya usan deactivate/activate más
	// abajo, se aplica acá como segundo paso en vez de convertir Activo a
	// *bool en todo el modelo por un solo caso de uso.
	if req.Borrador {
		if err := h.db.Model(&alojamiento).Update("activo", false).Error; err != nil {
			writeError(w, http.StatusInternalServerError, "error creando el alojamiento")
			return
		}
		alojamiento.Activo = false
	}

	writeJSON(w, http.StatusCreated, toAlojamientoResponse(alojamiento))
}

func (h *alojamientoHandler) update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "id inválido")
		return
	}

	var alojamiento db.Alojamiento
	if err := h.db.First(&alojamiento, "id = ?", id).Error; err != nil {
		writeError(w, http.StatusNotFound, "alojamiento no encontrado")
		return
	}

	var req alojamientoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "cuerpo de la petición inválido")
		return
	}
	if msg := req.validate(); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}

	alojamiento.Nombre = strings.TrimSpace(req.Nombre)
	alojamiento.Descripcion = req.Descripcion
	alojamiento.Lat = req.Lat
	alojamiento.Lng = req.Lng
	alojamiento.Direccion = req.Direccion
	alojamiento.PrecioNoche = req.PrecioNoche
	alojamiento.Capacidad = req.Capacidad

	if err := h.db.Save(&alojamiento).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "error actualizando el alojamiento")
		return
	}

	writeJSON(w, http.StatusOK, toAlojamientoResponse(alojamiento))
}

// deactivate — DELETE /alojamientos/{id}: "dar de baja" (spec §4.7), no un
// borrado físico — deja de aparecer en el listado público pero conserva su
// historial de reservas/reseñas.
func (h *alojamientoHandler) deactivate(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "id inválido")
		return
	}

	res := h.db.Model(&db.Alojamiento{}).Where("id = ?", id).Update("activo", false)
	if res.Error != nil {
		writeError(w, http.StatusInternalServerError, "error dando de baja el alojamiento")
		return
	}
	if res.RowsAffected == 0 {
		writeError(w, http.StatusNotFound, "alojamiento no encontrado")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// activate — POST /alojamientos/{id}/activar: publica un alojamiento que
// estaba de baja o en borrador (T4.19) — contraparte simétrica de
// deactivate. Reemplaza al viejo mecanismo de "reactivar reenviando un PUT
// idéntico" (que en los hechos no tocaba Activo, ver comentario que había
// en lib/api.ts del frontend) por un endpoint dedicado, sin side-effects
// sobre el resto de los campos.
func (h *alojamientoHandler) activate(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "id inválido")
		return
	}

	res := h.db.Model(&db.Alojamiento{}).Where("id = ?", id).Update("activo", true)
	if res.Error != nil {
		writeError(w, http.StatusInternalServerError, "error activando el alojamiento")
		return
	}
	if res.RowsAffected == 0 {
		writeError(w, http.StatusNotFound, "alojamiento no encontrado")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// uploadFoto — POST /alojamientos/{id}/fotos, multipart/form-data con el
// archivo en el campo "foto". El tipo se valida con http.DetectContentType
// sobre el contenido real (no el Content-Type que manda el cliente, que se
// puede mentir) — solo JPEG/PNG/WebP.
func (h *alojamientoHandler) uploadFoto(w http.ResponseWriter, r *http.Request) {
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

	// El límite de arriba tiene que alcanzar para el caso más grande
	// posible en este endpoint (video) — recién después de sniffear el
	// contenido real se sabe si era una foto, momento en el que se aplica
	// el tope más chico de foto (T4.17).
	r.Body = http.MaxBytesReader(w, r.Body, maxVideoUploadBytes)
	if err := r.ParseMultipartForm(maxVideoUploadBytes); err != nil {
		writeError(w, http.StatusBadRequest, "el archivo supera el tamaño máximo permitido (300MB)")
		return
	}
	defer func() { _ = r.MultipartForm.RemoveAll() }()

	file, header, err := r.FormFile("foto")
	if err != nil {
		writeError(w, http.StatusBadRequest, "falta el archivo 'foto'")
		return
	}
	defer func() { _ = file.Close() }()

	sniff := make([]byte, 512)
	n, _ := file.Read(sniff)
	contentType := http.DetectContentType(sniff[:n])

	// T4.13: la misma carga acepta foto o video — el tipo detectado decide
	// db.Foto.Tipo, que el frontend usa para renderizar <Image> o <video>.
	var tipo string
	switch {
	case allowedImageTypes[contentType]:
		tipo = "foto"
	case allowedVideoTypes[contentType]:
		tipo = "video"
	default:
		writeError(w, http.StatusBadRequest, "solo se aceptan imágenes JPEG/PNG/WebP o video MP4/WebM/MOV")
		return
	}
	// T4.17: una foto sigue topeada a maxImageUploadBytes aunque el
	// request en general se haya aceptado hasta maxVideoUploadBytes.
	if tipo == "foto" && header.Size > maxImageUploadBytes {
		writeError(w, http.StatusBadRequest, "las imágenes no pueden superar los 15MB")
		return
	}
	fullReader := io.MultiReader(bytes.NewReader(sniff[:n]), file)

	url, err := h.storage.Save(r.Context(), header.Filename, fullReader)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "error guardando el archivo")
		return
	}

	var maxOrden int
	h.db.Model(&db.Foto{}).
		Where("alojamiento_id = ?", alojamientoID).
		Select("COALESCE(MAX(orden), -1)").
		Scan(&maxOrden)

	foto := db.Foto{AlojamientoID: alojamientoID, URL: url, Orden: maxOrden + 1, Tipo: tipo}
	if err := h.db.Create(&foto).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "error guardando el archivo")
		return
	}

	writeJSON(w, http.StatusCreated, toFotoResponse(foto))
}

// uploadPortada — POST /alojamientos/{id}/portada (T4.14): sube la foto
// de portada del alojamiento, la miniatura que se ve en la tarjeta del
// listado de Alojamiento — distinta de la galería del detalle
// (uploadFoto). Solo imagen (nunca video: la tarjeta necesita algo fijo).
// Desmarca cualquier portada anterior en la misma transacción, así nunca
// hay dos filas EsPortada=true al mismo tiempo para un alojamiento.
func (h *alojamientoHandler) uploadPortada(w http.ResponseWriter, r *http.Request) {
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

	r.Body = http.MaxBytesReader(w, r.Body, maxImageUploadBytes)
	if err := r.ParseMultipartForm(maxImageUploadBytes); err != nil {
		writeError(w, http.StatusBadRequest, "la portada no puede superar los 15MB")
		return
	}
	defer func() { _ = r.MultipartForm.RemoveAll() }()

	file, header, err := r.FormFile("portada")
	if err != nil {
		writeError(w, http.StatusBadRequest, "falta el archivo 'portada'")
		return
	}
	defer func() { _ = file.Close() }()

	sniff := make([]byte, 512)
	n, _ := file.Read(sniff)
	if !allowedImageTypes[http.DetectContentType(sniff[:n])] {
		writeError(w, http.StatusBadRequest, "la portada tiene que ser una imagen JPEG, PNG o WebP")
		return
	}
	fullReader := io.MultiReader(bytes.NewReader(sniff[:n]), file)

	url, err := h.storage.Save(r.Context(), header.Filename, fullReader)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "error guardando la portada")
		return
	}

	var maxOrden int
	h.db.Model(&db.Foto{}).
		Where("alojamiento_id = ?", alojamientoID).
		Select("COALESCE(MAX(orden), -1)").
		Scan(&maxOrden)

	foto := db.Foto{AlojamientoID: alojamientoID, URL: url, Orden: maxOrden + 1, Tipo: "foto", EsPortada: true}
	err = h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&db.Foto{}).
			Where("alojamiento_id = ? AND es_portada = ?", alojamientoID, true).
			Update("es_portada", false).Error; err != nil {
			return err
		}
		return tx.Create(&foto).Error
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "error guardando la portada")
		return
	}

	writeJSON(w, http.StatusCreated, toFotoResponse(foto))
}

func (h *alojamientoHandler) deleteFoto(w http.ResponseWriter, r *http.Request) {
	alojamientoID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "id inválido")
		return
	}
	fotoID, err := uuid.Parse(chi.URLParam(r, "fotoId"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "id de foto inválido")
		return
	}

	res := h.db.Where("id = ? AND alojamiento_id = ?", fotoID, alojamientoID).Delete(&db.Foto{})
	if res.Error != nil {
		writeError(w, http.StatusInternalServerError, "error borrando la foto")
		return
	}
	if res.RowsAffected == 0 {
		writeError(w, http.StatusNotFound, "foto no encontrada")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
