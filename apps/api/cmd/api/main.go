// Command api arranca el backend HTTP de Turismo Marcuzzi.
package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/joho/godotenv"

	"turismo-marcuzzi/api/internal/config"
	"turismo-marcuzzi/api/internal/db"
	"turismo-marcuzzi/api/internal/email"
	"turismo-marcuzzi/api/internal/googleauth"
	apihttp "turismo-marcuzzi/api/internal/http"
	"turismo-marcuzzi/api/internal/reservas"
	"turismo-marcuzzi/api/internal/storage"
	"turismo-marcuzzi/api/internal/turnstile"
)

func main() {
	// .env es opcional (útil en desarrollo local); en producción las
	// variables de entorno las provee la plataforma de deploy.
	if err := godotenv.Load(); err != nil {
		log.Println("no se encontró .env, usando variables de entorno del sistema")
	}

	cfg := config.Load()

	gormDB, err := db.Connect(cfg.DBUrl)
	if err != nil {
		log.Fatalf("error conectando a la base de datos: %v", err)
	}

	// TR-041: con R2_BUCKET configurado (producción/Render), sube a
	// Cloudflare R2 — sin eso (desarrollo local, TR-013), sigue en disco.
	// El log de qué storage quedó activo es a propósito (no solo un log de
	// arranque más): es la única forma de confirmar desde los logs de
	// Render, sin adivinar, que la config de R2 efectivamente se está
	// usando y no cayó en el fallback de disco local por un env var vacío.
	var store storage.Storage
	if cfg.R2Bucket != "" {
		store, err = storage.NewR2Storage(context.Background(), cfg.R2AccountID, cfg.R2AccessKeyID, cfg.R2SecretAccessKey, cfg.R2Bucket, cfg.R2PublicURL)
		log.Printf("storage: Cloudflare R2 (bucket=%q, public_url=%q)", cfg.R2Bucket, cfg.R2PublicURL)
	} else {
		store, err = storage.NewLocalStorage(cfg.UploadsDir, cfg.UploadsBaseURL)
		log.Printf("storage: disco local (dir=%q) — NO persiste entre deploys, ver TR-013/TR-041", cfg.UploadsDir)
	}
	if err != nil {
		log.Fatalf("error inicializando storage de fotos: %v", err)
	}

	// TR-014/TR-049: con RESEND_API_KEY configurada, manda emails de
	// verdad vía Resend; sin eso (desarrollo local sin cuenta todavía),
	// loguea en vez de mandar — ver internal/email.
	var sender email.Sender
	if cfg.ResendAPIKey != "" {
		sender = email.ResendSender{APIKey: cfg.ResendAPIKey, From: cfg.ResendFromEmail}
		log.Printf("email: Resend (from=%q)", cfg.ResendFromEmail)
	} else {
		sender = email.LogSender{}
		log.Println("email: LogSender (sin RESEND_API_KEY) — los emails quedan en este log, no se mandan de verdad")
	}

	// TR-047: verifica el CAPTCHA (Cloudflare Turnstile) del registro del
	// lado del servidor — con el secret de prueba por defecto (ver
	// config.Load) funciona en desarrollo local sin credenciales reales.
	captcha := turnstile.HTTPVerifier{Secret: cfg.TurnstileSecretKey}

	// Prompt 2 (2026-08-18): sin GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET
	// configurados (no hay par de prueba público como el de Turnstile —
	// hace falta una cuenta real de Google Cloud), google queda nil y
	// POST /auth/google devuelve un error claro en vez de arrancar a
	// medias con credenciales vacías.
	var googleExchanger googleauth.Exchanger
	if cfg.GoogleClientID != "" && cfg.GoogleClientSecret != "" {
		googleExchanger = googleauth.HTTPExchanger{ClientID: cfg.GoogleClientID, ClientSecret: cfg.GoogleClientSecret}
		log.Println("google sign-in: configurado")
	} else {
		log.Println("google sign-in: deshabilitado (sin GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET)")
	}

	router := apihttp.NewRouter(gormDB, cfg.JWTSecret, store, cfg.UploadsDir, sender, cfg.CORSAllowedOrigins, captcha, googleExchanger)

	// T3.5/T3.7/TR-015/TR-016: barrido de reservas 'pendiente' vencidas
	// (5 min sin contactar, o 2h contactadas sin confirmar). Cada 30s, no
	// cada 1 min: con un TTL corto de 5 minutos, un barrido de 1 minuto
	// deja pasar hasta un minuto entero de margen — 30s lo ajusta sin
	// sobrecargar la DB. Corre en el mismo proceso — ver internal/reservas.
	expirerCtx, stopExpirer := context.WithCancel(context.Background())
	defer stopExpirer()
	go reservas.RunExpirer(expirerCtx, gormDB, 30*time.Second)

	log.Printf("turismo-marcuzzi api escuchando en :%s (env=%s)", cfg.Port, cfg.Env)
	if err := http.ListenAndServe(":"+cfg.Port, router); err != nil {
		log.Fatalf("error arrancando el servidor: %v", err)
	}
}
