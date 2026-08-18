// Package usuarios contiene lógica de negocio de usuarios que no es
// puramente HTTP — hoy, el vencimiento automático de cuentas sin
// confirmar abandonadas (2026-08-18, TR-053), mismo espíritu que
// internal/reservas para reservas 'pendiente' vencidas.
package usuarios

import (
	"context"
	"log"
	"time"

	"gorm.io/gorm"

	"turismo-marcuzzi/api/internal/clock"
	"turismo-marcuzzi/api/internal/db"
)

// GraciaTrasVencimiento — cuánto tiempo después de que venza el último
// código de confirmación se considera una cuenta sin confirmar
// definitivamente abandonada, no solo "todavía no la confirmó". Mucho
// más que los 15 minutos que dura el código en sí
// (codigoConfirmacionTTL, internal/http/auth.go) — le da margen real a
// alguien que vuelve más tarde a pedir un código nuevo (reenviar-codigo)
// o a reintentar el registro (TR-052) antes de borrarle la cuenta entera.
const GraciaTrasVencimiento = 48 * time.Hour

// ExpireSinConfirmar BORRA toda cuenta con EmailConfirmado=false cuyo
// último código de confirmación venció hace más de GraciaTrasVencimiento
// — registros abandonados de verdad (nadie volvió a pedir un código
// nuevo en todo ese tiempo). Una cuenta recién registrada o con un
// reenvío reciente tiene codigo_expiracion en el futuro (o vencido hace
// poco) — no la toca. Nunca toca una cuenta ya confirmada, sin importar
// su antigüedad. Devuelve cuántas filas borró.
func ExpireSinConfirmar(ctx context.Context, gdb *gorm.DB) (int64, error) {
	limite := clock.Now().Add(-GraciaTrasVencimiento)
	res := gdb.WithContext(ctx).
		Where("email_confirmado = ? AND codigo_expiracion IS NOT NULL AND codigo_expiracion < ?", false, limite).
		Delete(&db.Usuario{})
	return res.RowsAffected, res.Error
}

// RunExpirer corre ExpireSinConfirmar cada `interval` hasta que ctx se
// cancela. Pensado para lanzarse como goroutine desde cmd/api/main.go,
// igual que internal/reservas.RunExpirer — un intervalo bastante más
// largo tiene sentido acá (GraciaTrasVencimiento son 48hs, no minutos).
func RunExpirer(ctx context.Context, gdb *gorm.DB, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			n, err := ExpireSinConfirmar(ctx, gdb)
			if err != nil {
				log.Printf("error borrando cuentas sin confirmar vencidas: %v", err)
				continue
			}
			if n > 0 {
				log.Printf("se borraron %d cuenta(s) sin confirmar abandonada(s) (GraciaTrasVencimiento=%s)", n, GraciaTrasVencimiento)
			}
		}
	}
}
