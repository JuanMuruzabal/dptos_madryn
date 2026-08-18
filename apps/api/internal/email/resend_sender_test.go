package email

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// apuntaA reemplaza apiURL por un httptest.Server para todo el test, y lo
// restaura al terminar — mismo patrón que internal/turnstile, nunca se le
// pega a la Resend real acá.
func apuntaA(t *testing.T, handler http.HandlerFunc) {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	original := apiURL
	apiURL = server.URL
	t.Cleanup(func() { apiURL = original })
}

func TestResendSender_EnvioExitosoMandaElBodyCorrecto(t *testing.T) {
	var recibido resendRequest
	var authHeader string
	apuntaA(t, func(w http.ResponseWriter, r *http.Request) {
		authHeader = r.Header.Get("Authorization")
		_ = json.NewDecoder(r.Body).Decode(&recibido)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":"abc"}`))
	})

	s := ResendSender{APIKey: "re_test_key", From: "no-reply@turismomarcuzzi.com.ar"}
	err := s.Send(context.Background(), "cliente@example.com", "Confirmá tu cuenta", "Tu código es 123456")
	if err != nil {
		t.Fatalf("err = %v, esperaba nil", err)
	}

	if authHeader != "Bearer re_test_key" {
		t.Errorf("Authorization = %q", authHeader)
	}
	if recibido.From != "no-reply@turismomarcuzzi.com.ar" {
		t.Errorf("From = %q", recibido.From)
	}
	if len(recibido.To) != 1 || recibido.To[0] != "cliente@example.com" {
		t.Errorf("To = %v", recibido.To)
	}
	if recibido.Subject != "Confirmá tu cuenta" {
		t.Errorf("Subject = %q", recibido.Subject)
	}
	if recibido.Text != "Tu código es 123456" {
		t.Errorf("Text = %q", recibido.Text)
	}
}

func TestResendSender_ErrorDeResendDevuelveElMensaje(t *testing.T) {
	apuntaA(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnprocessableEntity)
		_, _ = w.Write([]byte(`{"message":"dominio del remitente no verificado"}`))
	})

	s := ResendSender{APIKey: "re_test_key", From: "no-reply@turismomarcuzzi.com.ar"}
	err := s.Send(context.Background(), "cliente@example.com", "asunto", "cuerpo")
	if err == nil {
		t.Fatal("esperaba un error")
	}
	if got := err.Error(); !strings.Contains(got, "dominio del remitente no verificado") {
		t.Errorf("error = %q, esperaba que incluyera el mensaje de Resend", got)
	}
}

func TestResendSender_ErrorSinMensajeUsaElStatus(t *testing.T) {
	apuntaA(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})

	s := ResendSender{APIKey: "k", From: "a@b.com"}
	err := s.Send(context.Background(), "cliente@example.com", "asunto", "cuerpo")
	if err == nil {
		t.Fatal("esperaba un error")
	}
}

func TestResendSender_ErrorDeRedDevuelveError(t *testing.T) {
	original := apiURL
	apiURL = "http://127.0.0.1:0" // puerto inválido, la conexión falla siempre
	t.Cleanup(func() { apiURL = original })

	s := ResendSender{APIKey: "k", From: "a@b.com"}
	err := s.Send(context.Background(), "cliente@example.com", "asunto", "cuerpo")
	if err == nil {
		t.Error("esperaba un error de red")
	}
}

func TestResendSender_SinClientPropioUsaElDefault(t *testing.T) {
	apuntaA(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":"abc"}`))
	})

	s := ResendSender{APIKey: "k", From: "a@b.com"} // Client queda nil
	if err := s.Send(context.Background(), "cliente@example.com", "asunto", "cuerpo"); err != nil {
		t.Fatalf("err = %v, esperaba nil", err)
	}
}

// ResendSender cumple la interfaz Sender (TR-014/TR-049).
func TestResendSender_CumpleLaInterfazSender(t *testing.T) {
	var _ Sender = ResendSender{}
}
