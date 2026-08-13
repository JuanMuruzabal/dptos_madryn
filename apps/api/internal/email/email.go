// Package email abstrae el envío de emails transaccionales (spec §6.2:
// Resend). Sin API key de Resend configurada en este entorno de
// desarrollo, la única implementación hoy es LogSender — ver TR-014 en
// docs/tradeoffs.md (mismo espíritu que internal/storage, TR-013).
package email

import "context"

// Sender manda un email transaccional simple (sin adjuntos ni templates
// con motor propio — alcanza para las confirmaciones de T3.3).
type Sender interface {
	Send(ctx context.Context, to, subject, body string) error
}
