// Package googleauth intercambia el authorization code que devuelve el
// flujo "Sign in with Google" del frontend (Google Identity Services,
// initCodeClient en modo popup) por los datos de la cuenta de Google del
// usuario — Prompt 2 de docs/prompts-login (1).md, 2026-08-18.
package googleauth

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

// tokenURL/userinfoURL son vars (no const) a propósito — mismo truco que
// turnstile.verifyURL/email.apiURL: los tests las apuntan a un
// httptest.NewServer, nunca pegan a Google de verdad.
var tokenURL = "https://oauth2.googleapis.com/token"
var userinfoURL = "https://www.googleapis.com/oauth2/v3/userinfo"

// redirectURIPopup es el valor fijo que Google Identity Services usa
// cuando el code se pidió en modo popup (ux_mode: "popup" de
// initCodeClient, ver google-signin-button.tsx) en vez de una redirección
// de página completa — no hace falta configurar una URI de redirect real
// para este flujo, es un valor sentinel que Google documenta así.
const redirectURIPopup = "postmessage"

// GoogleUser son los datos de la cuenta de Google ya verificados por
// Google mismo — Exchange solo los expone, la decisión de qué hacer con
// ellos (crear cuenta, vincular una existente) vive en internal/http/auth.go.
type GoogleUser struct {
	Sub           string // identificador estable de la cuenta de Google.
	Email         string
	EmailVerified bool
	Name          string
}

// Exchanger es la interfaz que internal/http/auth.go usa — nil la
// deshabilita (mismo convenio que turnstile.Verifier): sin
// GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET configurados, POST /auth/google
// devuelve un error claro en vez de intentar pegarle a Google sin
// credenciales.
type Exchanger interface {
	Exchange(ctx context.Context, code string) (GoogleUser, error)
}

// HTTPExchanger implementa Exchanger contra la API real de Google: primero
// cambia el code por tokens (POST a tokenURL, requiere el client secret —
// por eso este intercambio pasa siempre por el backend, nunca por el
// navegador), después pide los datos del usuario con el access_token que
// devolvió ese primer paso.
type HTTPExchanger struct {
	ClientID     string
	ClientSecret string
	Client       *http.Client
}

type tokenResponse struct {
	AccessToken string `json:"access_token"`
	Error       string `json:"error"`
	ErrorDesc   string `json:"error_description"`
}

type userinfoResponse struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
}

func (e HTTPExchanger) client() *http.Client {
	if e.Client != nil {
		return e.Client
	}
	return http.DefaultClient
}

func (e HTTPExchanger) Exchange(ctx context.Context, code string) (GoogleUser, error) {
	accessToken, err := e.exchangeCodeForToken(ctx, code)
	if err != nil {
		return GoogleUser{}, err
	}
	return e.fetchUserinfo(ctx, accessToken)
}

func (e HTTPExchanger) exchangeCodeForToken(ctx context.Context, code string) (string, error) {
	form := url.Values{
		"code":          {code},
		"client_id":     {e.ClientID},
		"client_secret": {e.ClientSecret},
		"redirect_uri":  {redirectURIPopup},
		"grant_type":    {"authorization_code"},
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", fmt.Errorf("armando el intercambio de code con Google: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := e.client().Do(req)
	if err != nil {
		return "", fmt.Errorf("intercambiando el code con Google: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	var out tokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", fmt.Errorf("decodificando la respuesta de token de Google: %w", err)
	}
	if out.Error != "" {
		return "", fmt.Errorf("google rechazó el code: %s (%s)", out.Error, out.ErrorDesc)
	}
	if out.AccessToken == "" {
		return "", fmt.Errorf("google no devolvió access_token")
	}
	return out.AccessToken, nil
}

func (e HTTPExchanger) fetchUserinfo(ctx context.Context, accessToken string) (GoogleUser, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, userinfoURL, nil)
	if err != nil {
		return GoogleUser{}, fmt.Errorf("armando el pedido de userinfo a Google: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := e.client().Do(req)
	if err != nil {
		return GoogleUser{}, fmt.Errorf("pidiendo userinfo a Google: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return GoogleUser{}, fmt.Errorf("google devolvió status %d pidiendo userinfo", resp.StatusCode)
	}

	var out userinfoResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return GoogleUser{}, fmt.Errorf("decodificando userinfo de Google: %w", err)
	}
	if out.Email == "" {
		return GoogleUser{}, fmt.Errorf("google no devolvió un email")
	}

	return GoogleUser(out), nil
}
