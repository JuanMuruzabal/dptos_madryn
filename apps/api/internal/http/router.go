// Package http arma el router HTTP del backend (chi) y expone los handlers.
package http

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"gorm.io/gorm"

	"turismo-marcuzzi/api/internal/email"
	"turismo-marcuzzi/api/internal/storage"
)

// NewRouter arma el router raíz de la API. db puede ser nil (arranque sin
// conexión configurada); jwtSecret firma los tokens emitidos en /auth;
// store persiste las fotos subidas (T2.1, ver internal/storage); uploadsDir
// es la carpeta física que sirve /uploads cuando store es LocalStorage
// (TR-013 en docs/tradeoffs.md) — servirla acá, no en LocalStorage, para
// que el router siga siendo el único lugar que sabe de rutas HTTP; sender
// manda los emails transaccionales de T3.3 (TR-014); corsOrigins son los
// orígenes permitidos para llamadas directas del navegador (config.Config.
// CORSAllowedOrigins, TR-041).
func NewRouter(db *gorm.DB, jwtSecret string, store storage.Storage, uploadsDir string, sender email.Sender, corsOrigins []string) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	// middleware.RealIP NO se usa: es vulnerable a IP spoofing si no hay un
	// proxy de confianza que garantice X-Forwarded-For/X-Real-IP (GHSA-3fxj
	// -6jh8-hvhx). Revisar si sumarlo cuando esté definido el proxy de deploy
	// real (T5.5, Railway/Fly.io).
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	// 5 minutos, no 30s (T4.17): con el tope de video en 300MB
	// (alojamientos.go, maxVideoUploadBytes), 30s se quedaba corto para
	// subir eso en una conexión hogareña típica — el timeout corta el
	// request a mitad de la subida, no solo al handler colgado. 5 minutos
	// sigue siendo un techo razonable para cualquier request real (las
	// normales, sin archivo, terminan en milisegundos igual).
	r.Use(middleware.Timeout(5 * time.Minute))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   corsOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
	}))

	r.Get("/health", healthHandler(db))

	r.Route("/auth", func(r chi.Router) {
		registerAuthRoutes(r, db, jwtSecret)
	})

	r.With(requireAuth(jwtSecret)).Get("/me", meHandler(db))

	registerAlojamientoRoutes(r, db, jwtSecret, store)
	registerReservaRoutes(r, db, jwtSecret, sender)
	registerResenaRoutes(r, db, jwtSecret)
	registerBloqueoRoutes(r, db, jwtSecret)
	registerContenidoRoutes(r, db, jwtSecret)
	registerImagenSitioRoutes(r, db, jwtSecret, store)

	// Estático: solo tiene contenido real cuando store es LocalStorage
	// (desarrollo). En producción con R2/S3 configurado, las URLs de las
	// fotos apuntan a otro dominio y esta ruta queda sin uso.
	r.Handle("/uploads/*", http.StripPrefix("/uploads/", http.FileServer(http.Dir(uploadsDir))))

	return r
}

func healthHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status := map[string]string{"status": "ok"}

		if db != nil {
			sqlDB, err := db.DB()
			if err != nil || sqlDB.PingContext(r.Context()) != nil {
				status["db"] = "unreachable"
				writeJSON(w, http.StatusServiceUnavailable, status)
				return
			}
			status["db"] = "ok"
		} else {
			status["db"] = "not_configured"
		}

		writeJSON(w, http.StatusOK, status)
	}
}

// writeJSON fija el Content-Type, escribe el status code y serializa v, en
// ese orden — WriteHeader debe llamarse después de setear headers, si no
// Go los descarta y sniffea el Content-Type solo (ver bug corregido en T0.5).
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
