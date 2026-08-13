// Package storage abstrae dónde se guardan las fotos subidas (spec §6.2:
// Cloudflare R2/S3 + CDN en producción). Sin credenciales de nube
// configuradas en este entorno de desarrollo, la única implementación hoy
// es disco local detrás de esta misma interfaz — ver TR-013 en
// docs/tradeoffs.md. Swap a R2/S3 más adelante implica escribir otro
// Storage, no tocar los handlers que la usan.
package storage

import (
	"context"
	"io"
)

// Storage guarda un archivo y devuelve la URL pública desde la que se sirve.
type Storage interface {
	Save(ctx context.Context, filename string, r io.Reader) (url string, err error)
}
