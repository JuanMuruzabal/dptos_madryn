package http

import (
	"bytes"
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"turismo-marcuzzi/api/internal/db"
	"turismo-marcuzzi/api/internal/storage"
)

// registerImagenSitioRoutes monta el "editor de página" (T4.13, spec
// §4.8): fotos editables de páginas principales que no son un alojamiento
// puntual (hero de la home, tarjetas de categoría) — ver comentario en
// db.ImagenSitio. Lectura pública, escritura admin-only.
func registerImagenSitioRoutes(r chi.Router, gdb *gorm.DB, jwtSecret string, store storage.Storage) {
	h := &imagenSitioHandler{db: gdb, storage: store}

	r.Get("/imagenes-sitio", h.list)
	r.Group(func(r chi.Router) {
		r.Use(requireAuth(jwtSecret), requireRole("administrador"))
		r.Put("/imagenes-sitio/{clave}", h.actualizar)
		r.Delete("/imagenes-sitio/{clave}", h.eliminar)
	})
}

type imagenSitioHandler struct {
	db      *gorm.DB
	storage storage.Storage
}

type imagenSitioResponse struct {
	Clave string `json:"clave"`
	URL   string `json:"url"`
}

// list — GET /imagenes-sitio: todas las claves con imagen cargada. Las
// claves sin fila (todavía sin override) simplemente no aparecen acá — el
// frontend sabe qué claves existen de antemano (lib/scenes.ts/categories.ts)
// y cae a su gradiente por defecto para las que faltan.
func (h *imagenSitioHandler) list(w http.ResponseWriter, r *http.Request) {
	var imagenes []db.ImagenSitio
	if err := h.db.Find(&imagenes).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "error obteniendo las imágenes")
		return
	}

	responses := make([]imagenSitioResponse, 0, len(imagenes))
	for _, img := range imagenes {
		responses = append(responses, imagenSitioResponse{Clave: img.Clave, URL: img.URL})
	}
	writeJSON(w, http.StatusOK, responses)
}

// actualizar — PUT /imagenes-sitio/{clave} (admin), multipart con el
// archivo en el campo "imagen". Solo imágenes (a diferencia de las fotos
// de alojamiento, T4.13, estas no llevan video — son fondos/tarjetas de
// layout, no una galería). Upsert real (INSERT ... ON CONFLICT), mismo
// motivo que contenido.go: Clave como primary key string siempre viene
// seteada, Save() no serviría para la primera carga de una clave nueva.
func (h *imagenSitioHandler) actualizar(w http.ResponseWriter, r *http.Request) {
	clave := chi.URLParam(r, "clave")

	r.Body = http.MaxBytesReader(w, r.Body, maxImageUploadBytes)
	if err := r.ParseMultipartForm(maxImageUploadBytes); err != nil {
		writeError(w, http.StatusBadRequest, "la imagen no puede superar los 15MB")
		return
	}
	defer func() { _ = r.MultipartForm.RemoveAll() }()

	file, header, err := r.FormFile("imagen")
	if err != nil {
		writeError(w, http.StatusBadRequest, "falta el archivo 'imagen'")
		return
	}
	defer func() { _ = file.Close() }()

	sniff := make([]byte, 512)
	n, _ := file.Read(sniff)
	if !allowedImageTypes[http.DetectContentType(sniff[:n])] {
		writeError(w, http.StatusBadRequest, "solo se aceptan imágenes JPEG, PNG o WebP")
		return
	}
	fullReader := io.MultiReader(bytes.NewReader(sniff[:n]), file)

	url, err := h.storage.Save(r.Context(), header.Filename, fullReader)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "error guardando la imagen")
		return
	}

	imagen := db.ImagenSitio{Clave: clave, URL: url}
	err = h.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "clave"}},
		DoUpdates: clause.AssignmentColumns([]string{"url", "updated_at"}),
	}).Create(&imagen).Error
	if err != nil {
		writeError(w, http.StatusInternalServerError, "error guardando la imagen")
		return
	}

	writeJSON(w, http.StatusOK, imagenSitioResponse{Clave: imagen.Clave, URL: imagen.URL})
}

// eliminar — DELETE /imagenes-sitio/{clave} (admin): vuelve la clave al
// gradiente por defecto (no hay "revertir a la anterior", solo "sacar el
// override").
func (h *imagenSitioHandler) eliminar(w http.ResponseWriter, r *http.Request) {
	clave := chi.URLParam(r, "clave")

	res := h.db.Where("clave = ?", clave).Delete(&db.ImagenSitio{})
	if res.Error != nil {
		writeError(w, http.StatusInternalServerError, "error eliminando la imagen")
		return
	}
	if res.RowsAffected == 0 {
		writeError(w, http.StatusNotFound, "no había ninguna imagen cargada para esta clave")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
