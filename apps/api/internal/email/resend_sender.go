package email

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

// apiURL es una var (no una const) a propósito — el mismo truco que
// turnstile.verifyURL: los tests la apuntan a un httptest.NewServer en
// vez de pegarle a la API real de Resend.
var apiURL = "https://api.resend.com/emails"

// ResendSender manda emails de verdad vía la API de Resend (spec §6.2,
// TR-014/TR-049) — reemplaza a LogSender cuando RESEND_API_KEY está
// seteada (cmd/api/main.go). From tiene que ser una dirección de un
// dominio verificado en la cuenta de Resend — con un dominio sin
// verificar, Resend devuelve error en cada envío.
type ResendSender struct {
	APIKey string
	From   string
	Client *http.Client
}

type resendRequest struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	Text    string   `json:"text"`
}

type resendErrorResponse struct {
	Message string `json:"message"`
}

func (s ResendSender) Send(ctx context.Context, to, subject, body string) error {
	payload, err := json.Marshal(resendRequest{
		From:    s.From,
		To:      []string{to},
		Subject: subject,
		Text:    body,
	})
	if err != nil {
		return fmt.Errorf("codificando el request a Resend: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("armando el request a Resend: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.APIKey)
	req.Header.Set("Content-Type", "application/json")

	client := s.Client
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("llamando a Resend: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}

	var errBody resendErrorResponse
	_ = json.NewDecoder(resp.Body).Decode(&errBody)
	if errBody.Message != "" {
		return fmt.Errorf("la api de resend devolvió %d: %s", resp.StatusCode, errBody.Message)
	}
	return fmt.Errorf("la api de resend devolvió status %d", resp.StatusCode)
}
