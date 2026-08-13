// Package reservas contiene lógica de negocio de reservas que no es
// puramente HTTP — hoy, el vencimiento automático en dos fases de
// reservas pendientes (T3.5/T3.7, TR-015/TR-016).
package reservas

import (
	"context"
	"log"
	"time"

	"gorm.io/gorm"

	"turismo-marcuzzi/api/internal/db"
)

// Vencimiento en dos fases (decisión del cliente, 2026-08-12): una reserva
// 'pendiente' tiene ContactoTTL para que alguien toque el botón de
// WhatsApp/mail (si no, nunca hubo intención real) — una vez contactada,
// pasa a tener ConfirmacionTTL para que el admin la confirme (si no, se
// asume que el pago nunca se coordinó). Las reservas pendientes siguen
// bloqueando el calendario igual que las confirmadas (TR-005 sin cambios),
// así que este doble timer es la única protección real contra alguien que
// reserva sin intención de pagar.
const (
	ContactoTTL     = 5 * time.Minute
	ConfirmacionTTL = 2 * time.Hour
)

// ExpirePendientes BORRA (no soft-cancela) toda reserva 'pendiente' que
// venció en la fase que le corresponde: sin contactar y con más de
// ContactoTTL desde que se creó, o contactada y con más de ConfirmacionTTL
// desde que se marcó el contacto. Devuelve cuántas filas tocó.
//
// Antes esto hacía estado='cancelada' (soft), pero una reserva que vence
// por timeout nunca tuvo intención real ni acción de ningún admin — a
// diferencia de una cancelación manual del panel (T4.4, que sí conserva la
// fila como historial), acá no hay nada que valga la pena conservar, solo
// ruido acumulándose en la pestaña "Canceladas" del panel (pedido del
// cliente, 2026-08-13). Borrar la fila entera libera el exclusion
// constraint exactamente igual que soft-cancelarla (una fila que no existe
// tampoco compite por el rango).
func ExpirePendientes(ctx context.Context, gdb *gorm.DB) (int64, error) {
	now := time.Now()
	res := gdb.WithContext(ctx).
		Where(
			`estado = 'pendiente' AND (
				(contactado_en IS NULL AND created_at < ?)
				OR
				(contactado_en IS NOT NULL AND contactado_en < ?)
			)`,
			now.Add(-ContactoTTL), now.Add(-ConfirmacionTTL),
		).
		Delete(&db.Reserva{})
	return res.RowsAffected, res.Error
}

// RunExpirer corre ExpirePendientes cada `interval` hasta que ctx se
// cancela. Pensado para lanzarse como goroutine desde cmd/api/main.go —
// no es un cron externo porque para el volumen de este proyecto (un solo
// dev, tráfico chico) un ticker en el mismo proceso alcanza; si el
// backend se escala a más de una instancia, esto corre en cada una, lo
// cual es inofensivo (el UPDATE es idempotente) pero redundante.
func RunExpirer(ctx context.Context, gdb *gorm.DB, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			n, err := ExpirePendientes(ctx, gdb)
			if err != nil {
				log.Printf("error venciendo reservas pendientes: %v", err)
				continue
			}
			if n > 0 {
				log.Printf("venció %d reserva(s) pendiente(s) (ContactoTTL=%s / ConfirmacionTTL=%s)", n, ContactoTTL, ConfirmacionTTL)
			}
		}
	}
}
