// Package config centraliza la lectura de variables de entorno del backend.
package config

import (
	"os"
	"strings"
)

// Config agrupa todo lo que el backend necesita para arrancar.
type Config struct {
	Port      string
	DBUrl     string
	JWTSecret string
	Env       string
	// UploadsDir/UploadsBaseURL configuran el Storage local de desarrollo
	// (internal/storage) — ver TR-013 en docs/tradeoffs.md. Se usan solo
	// si R2AccountID/R2Bucket no están seteados (ver abajo).
	UploadsDir     string
	UploadsBaseURL string
	// R2AccountID/R2AccessKeyID/R2SecretAccessKey/R2Bucket/R2PublicURL
	// (TR-041) — con R2Bucket configurado, cmd/api/main.go usa R2Storage
	// en vez de LocalStorage. Vacíos por defecto: sin esto seteado, el
	// comportamiento de desarrollo local no cambia.
	R2AccountID       string
	R2AccessKeyID     string
	R2SecretAccessKey string
	R2Bucket          string
	R2PublicURL       string
	// CORSAllowedOrigins — orígenes desde los que el navegador puede
	// llamar directo a la API (no afecta las llamadas server-to-server de
	// Next.js vía Server Actions/Components, que no pasan por CORS). En
	// producción, la URL pública del servicio web de Render.
	CORSAllowedOrigins []string
	// TurnstileSecretKey (2026-08-17, TR-047) — verifica del lado del
	// servidor el CAPTCHA del registro (internal/turnstile). El default es
	// el secret key de PRUEBA que Cloudflare documenta públicamente y que
	// siempre aprueba (https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
	// — no es información sensible, es a propósito así de conocido; con
	// esto el registro funciona en desarrollo local sin necesitar una
	// cuenta de Cloudflare real todavía. En producción se pisa con la
	// secret key real (Render, sync: false, ver render.yaml).
	TurnstileSecretKey string
	// ResendAPIKey/ResendFromEmail (2026-08-18, Prompt 2 de docs/prompts-login
	// (1).md) — mandan de verdad el email de confirmación de cuenta.
	// Vacío por defecto: cmd/api/main.go cae a email.LogSender (TR-014),
	// el registro sigue funcionando en desarrollo local sin cuenta de
	// Resend, solo que el código queda en el log del servidor en vez de
	// llegar por email de verdad.
	ResendAPIKey    string
	ResendFromEmail string
	// GoogleClientID/GoogleClientSecret (2026-08-18, Prompt 2) — credenciales
	// OAuth de Google Cloud Console para "Ingresá con Google". Vacíos por
	// defecto: cmd/api/main.go no arma ningún googleauth.Exchanger (queda
	// nil, mismo convenio que TurnstileSecretKey/captcha) — POST
	// /auth/google devuelve un error claro en vez de fallar a medias sin
	// credenciales reales. No hay un par de prueba público como el de
	// Turnstile — hace falta una cuenta real de Google Cloud para probar
	// este flujo, incluso en desarrollo local.
	GoogleClientID     string
	GoogleClientSecret string
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

		R2AccountID:       getEnv("R2_ACCOUNT_ID", ""),
		R2AccessKeyID:     getEnv("R2_ACCESS_KEY_ID", ""),
		R2SecretAccessKey: getEnv("R2_SECRET_ACCESS_KEY", ""),
		R2Bucket:          getEnv("R2_BUCKET", ""),
		R2PublicURL:       getEnv("R2_PUBLIC_URL", ""),

		CORSAllowedOrigins: getEnvList("CORS_ALLOWED_ORIGINS", []string{"http://localhost:3000"}),

		TurnstileSecretKey: getEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA"),

		ResendAPIKey:    getEnv("RESEND_API_KEY", ""),
		ResendFromEmail: getEnv("RESEND_FROM_EMAIL", ""),

		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
	}
}

// Bug real en producción (2026-08-18): una API key de Resend pegada en el
// dashboard de Render con un salto de línea de más al final rompía
// net/http con "invalid header field value for Authorization" — un
// espacio/salto de línea invisible es un error humano fácil de cometer al
// copiar cualquier secret desde cualquier lado. strings.TrimSpace acá,
// una sola vez en el punto de entrada de TODAS las variables de entorno,
// es más robusto que confiar en que cada lugar que arma un header/URL/etc.
// se acuerde de limpiar el valor por su cuenta.
func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok {
		if trimmed := strings.TrimSpace(v); trimmed != "" {
			return trimmed
		}
	}
	return fallback
}

// getEnvList lee una lista separada por comas (p. ej.
// "https://a.com,https://b.com") — se usa para CORS_ALLOWED_ORIGINS,
// donde en producción puede hacer falta más de un origen (p. ej. un
// dominio propio y el subdominio *.onrender.com mientras se migra el DNS).
func getEnvList(key string, fallback []string) []string {
	raw, ok := os.LookupEnv(key)
	if !ok || raw == "" {
		return fallback
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if trimmed := strings.TrimSpace(p); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	if len(out) == 0 {
		return fallback
	}
	return out
}
