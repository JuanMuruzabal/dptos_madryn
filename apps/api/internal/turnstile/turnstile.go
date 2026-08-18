// Package turnstile verifica tokens de Cloudflare Turnstile (CAPTCHA,
// 2026-08-17, pedido del cliente: "la implementacion del capcha al crear
// [cuenta]") del lado del servidor — un token que el frontend manda solo
// no prueba nada por sí solo, hace falta confirmarlo contra la API de
// Cloudflare con el secret key, que nunca viaja al navegador (ver TR-047
// en docs/tradeoffs.md sobre por qué Turnstile y no reCAPTCHA).
package turnstile

import (
	"encoding/json"
	"net/http"
	"net/url"
)

// verifyURL es var (no const) para poder apuntarlo a un httptest.Server en
// los tests — nunca se pega a la Cloudflare real en un test unitario.
var verifyURL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

// Verifier confirma un token de Turnstile — interfaz para poder inyectar un
// fake en los tests de internal/http (mismo criterio que
// internal/email.Sender: nunca pegarle a un servicio externo real desde un
// test unitario).
type Verifier interface {
	Verify(token, remoteIP string) (bool, error)
}

// HTTPVerifier es la implementación real, contra la API de Cloudflare.
// Secret vacío (zero value) es válido a propósito: Cloudflare provee
// secret keys de prueba públicas y documentadas que siempre aprueban/
// rechazan de forma predecible — apps/api/internal/config.Config usa una
// de esas como default de desarrollo, así que Verify funciona out-of-the-
// box en local sin necesitar una cuenta de Cloudflare real todavía.
type HTTPVerifier struct {
	Secret string
	// Client nil usa http.DefaultClient — solo se fija a mano en tests.
	Client *http.Client
}

type verifyResponse struct {
	Success bool `json:"success"`
}

func (v HTTPVerifier) Verify(token, remoteIP string) (bool, error) {
	if token == "" {
		return false, nil
	}

	form := url.Values{"secret": {v.Secret}, "response": {token}}
	if remoteIP != "" {
		form.Set("remoteip", remoteIP)
	}

	client := v.Client
	if client == nil {
		client = http.DefaultClient
	}

	resp, err := client.PostForm(verifyURL, form)
	if err != nil {
		return false, err
	}
	defer func() { _ = resp.Body.Close() }()

	var out verifyResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return false, err
	}
	return out.Success, nil
}
