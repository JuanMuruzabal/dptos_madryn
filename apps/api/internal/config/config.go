// Package config centraliza la lectura de variables de entorno del backend.
package config

import (
	"os"
)

// Config agrupa todo lo que el backend necesita para arrancar.
type Config struct {
	Port      string
	DBUrl     string
	JWTSecret string
	Env       string
	// UploadsDir/UploadsBaseURL configuran el Storage local de desarrollo
	// (internal/storage) — ver TR-013 en docs/tradeoffs.md. En producción,
	// con R2/S3 configurado, estas quedan sin uso.
	UploadsDir     string
	UploadsBaseURL string
}

// Load lee la configuración desde variables de entorno, con valores por
// defecto razonables para desarrollo local.
func Load() Config {
	port := getEnv("PORT", "8080")
	return Config{
		Port:           port,
		DBUrl:          getEnv("DATABASE_URL", "postgres://turismo:turismo@localhost:5432/turismo_marcuzzi?sslmode=disable"),
		JWTSecret:      getEnv("JWT_SECRET", "dev-secret-cambiar-en-produccion"),
		Env:            getEnv("APP_ENV", "development"),
		UploadsDir:     getEnv("UPLOADS_DIR", "./uploads"),
		UploadsBaseURL: getEnv("UPLOADS_BASE_URL", "http://localhost:"+port+"/uploads"),
	}
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}
