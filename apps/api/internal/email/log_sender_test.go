package email

import (
	"bytes"
	"context"
	"log"
	"strings"
	"testing"
)

func TestLogSender_Send_NuncaDevuelveError(t *testing.T) {
	var s LogSender
	if err := s.Send(context.Background(), "cliente@example.com", "Asunto", "Cuerpo"); err != nil {
		t.Fatalf("LogSender.Send no debería fallar nunca, devolvió: %v", err)
	}
}

func TestLogSender_Send_LogueaLosDatosDelEmail(t *testing.T) {
	var buf bytes.Buffer
	original := log.Writer()
	log.SetOutput(&buf)
	t.Cleanup(func() { log.SetOutput(original) })

	var s LogSender
	if err := s.Send(context.Background(), "destinatario@example.com", "Reserva confirmada", "Detalle de la reserva"); err != nil {
		t.Fatalf("Send devolvió error: %v", err)
	}

	salida := buf.String()
	for _, esperado := range []string{"destinatario@example.com", "Reserva confirmada", "Detalle de la reserva"} {
		if !strings.Contains(salida, esperado) {
			t.Errorf("el log debería incluir %q, salida completa: %s", esperado, salida)
		}
	}
}

// Sender es una interfaz de un solo método (TR-014) para poder swapear
// LogSender por un Resend real más adelante sin tocar los handlers.
func TestLogSender_CumpleLaInterfazSender(t *testing.T) {
	var _ Sender = LogSender{}
}
