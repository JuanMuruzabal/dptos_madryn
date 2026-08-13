package storage

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
)

// LocalStorage guarda archivos en disco y los sirve vía la ruta estática
// /uploads montada en el router (ver router.go). Es el Storage por
// defecto de desarrollo (TR-013) — no pensado para producción (el
// filesystem de la mayoría de los proveedores de deploy no es
// persistente entre despliegues).
type LocalStorage struct {
	dir       string
	publicURL string
}

// NewLocalStorage crea (si hace falta) el directorio dir y arma un
// LocalStorage que expone sus archivos bajo publicURL (p. ej.
// "http://localhost:8080/uploads").
func NewLocalStorage(dir, publicURL string) (*LocalStorage, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("creando directorio de uploads: %w", err)
	}
	return &LocalStorage{
		dir:       dir,
		publicURL: strings.TrimSuffix(publicURL, "/"),
	}, nil
}

// Save ignora el filename original más allá de su extensión — lo
// renombra con un uuid para evitar colisiones y path traversal (nunca se
// usa el nombre que manda el cliente como ruta de archivo).
func (s *LocalStorage) Save(ctx context.Context, filename string, r io.Reader) (string, error) {
	ext := strings.ToLower(filepath.Ext(filename))
	safeName := uuid.NewString() + ext

	f, err := os.Create(filepath.Join(s.dir, safeName))
	if err != nil {
		return "", fmt.Errorf("creando archivo: %w", err)
	}
	defer func() { _ = f.Close() }()

	if _, err := io.Copy(f, r); err != nil {
		return "", fmt.Errorf("escribiendo archivo: %w", err)
	}

	return s.publicURL + "/" + safeName, nil
}
