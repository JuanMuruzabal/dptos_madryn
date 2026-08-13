package email

import (
	"context"
	"log"
)

// LogSender no manda nada de verdad — imprime el email en el log del
// servidor. Es el Sender por defecto de desarrollo (TR-014): sin API key
// de Resend, esto deja el flujo de T3.1/T3.2 completo y probable de punta
// a punta sin bloquear en una cuenta de terceros.
type LogSender struct{}

func (LogSender) Send(_ context.Context, to, subject, body string) error {
	log.Printf("[email] (no enviado, LogSender) para=%s asunto=%q\n%s", to, subject, body)
	return nil
}
