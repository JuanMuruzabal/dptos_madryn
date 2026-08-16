package storage

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestNewLocalStorage_CreaElDirectorioSiNoExiste(t *testing.T) {
	base := t.TempDir()
	dir := filepath.Join(base, "no-existe-todavia")

	if _, err := NewLocalStorage(dir, "http://localhost:8080/uploads"); err != nil {
		t.Fatalf("NewLocalStorage devolvió error: %v", err)
	}

	info, err := os.Stat(dir)
	if err != nil {
		t.Fatalf("el directorio debería existir después de NewLocalStorage: %v", err)
	}
	if !info.IsDir() {
		t.Fatal("el path creado debería ser un directorio")
	}
}

func TestNewLocalStorage_RecortaBarraFinalDePublicURL(t *testing.T) {
	s, err := NewLocalStorage(t.TempDir(), "http://localhost:8080/uploads/")
	if err != nil {
		t.Fatalf("NewLocalStorage devolvió error: %v", err)
	}

	url, err := s.Save(context.Background(), "foto.jpg", strings.NewReader("contenido"))
	if err != nil {
		t.Fatalf("Save devolvió error: %v", err)
	}
	if strings.Contains(url, "uploads//") {
		t.Fatalf("la URL no debería tener doble barra, dio %q", url)
	}
}

func TestSave_EscribeElContenidoYDevuelveURLConExtension(t *testing.T) {
	dir := t.TempDir()
	s, err := NewLocalStorage(dir, "http://localhost:8080/uploads")
	if err != nil {
		t.Fatalf("NewLocalStorage devolvió error: %v", err)
	}

	contenido := "esto-es-el-contenido-del-archivo"
	url, err := s.Save(context.Background(), "MiFoto.JPG", strings.NewReader(contenido))
	if err != nil {
		t.Fatalf("Save devolvió error: %v", err)
	}

	if !strings.HasPrefix(url, "http://localhost:8080/uploads/") {
		t.Fatalf("URL = %q, esperaba prefijo http://localhost:8080/uploads/", url)
	}
	// La extensión se conserva pero en minúscula, aunque el original venga
	// en mayúsculas — filesystems case-sensitive (Linux en prod) no deben
	// terminar sirviendo la URL con una extensión que no matchea el archivo.
	if !strings.HasSuffix(url, ".jpg") {
		t.Fatalf("URL = %q, esperaba que terminara en \".jpg\" (minúscula)", url)
	}

	nombreArchivo := strings.TrimPrefix(url, "http://localhost:8080/uploads/")
	guardado, err := os.ReadFile(filepath.Join(dir, nombreArchivo))
	if err != nil {
		t.Fatalf("no se pudo leer el archivo guardado: %v", err)
	}
	if string(guardado) != contenido {
		t.Fatalf("contenido guardado = %q, esperaba %q", guardado, contenido)
	}
}

func TestSave_DosArchivosConElMismoNombreOriginalNoColisionan(t *testing.T) {
	dir := t.TempDir()
	s, err := NewLocalStorage(dir, "http://localhost:8080/uploads")
	if err != nil {
		t.Fatalf("NewLocalStorage devolvió error: %v", err)
	}

	url1, err := s.Save(context.Background(), "foto.png", strings.NewReader("primero"))
	if err != nil {
		t.Fatalf("Save (1) devolvió error: %v", err)
	}
	url2, err := s.Save(context.Background(), "foto.png", strings.NewReader("segundo"))
	if err != nil {
		t.Fatalf("Save (2) devolvió error: %v", err)
	}

	if url1 == url2 {
		t.Fatalf("dos subidas con el mismo nombre original terminaron en la misma URL: %q", url1)
	}
}

// Storage es una interfaz de un solo método (TR-013) justamente para que
// LocalStorage pueda swapearse por R2/S3 más adelante — este test es la
// garantía en compile-time de que la implementación sigue cumpliendo el
// contrato.
func TestLocalStorage_CumpleLaInterfazStorage(t *testing.T) {
	var _ Storage = (*LocalStorage)(nil)
}

func TestNewLocalStorage_ErrorSiElPathNoSePuedeCrear(t *testing.T) {
	// Un archivo regular no puede tener subdirectorios — MkdirAll sobre
	// algo/adentro-de-un-archivo tiene que fallar.
	archivo := filepath.Join(t.TempDir(), "esto-es-un-archivo")
	if err := os.WriteFile(archivo, []byte("x"), 0o644); err != nil {
		t.Fatalf("no se pudo preparar el archivo de prueba: %v", err)
	}

	if _, err := NewLocalStorage(filepath.Join(archivo, "sub"), "http://localhost:8080/uploads"); err == nil {
		t.Fatal("NewLocalStorage debería fallar si el directorio no se puede crear")
	}
}

func TestSave_ErrorSiElDirectorioNoExiste(t *testing.T) {
	// Construido directo (mismo package) sin pasar por NewLocalStorage,
	// que es justamente quien crea el directorio — así se prueba el
	// branch de error de os.Create en Save de forma aislada.
	s := &LocalStorage{dir: filepath.Join(t.TempDir(), "no-existe"), publicURL: "http://localhost:8080/uploads"}

	if _, err := s.Save(context.Background(), "foto.jpg", strings.NewReader("x")); err == nil {
		t.Fatal("Save debería fallar si el directorio de destino no existe")
	}
}

type readerQueSiempreFalla struct{}

func (readerQueSiempreFalla) Read([]byte) (int, error) {
	return 0, errors.New("error de lectura simulado")
}

func TestSave_ErrorSiFallaLaLecturaDelArchivo(t *testing.T) {
	s, err := NewLocalStorage(t.TempDir(), "http://localhost:8080/uploads")
	if err != nil {
		t.Fatalf("NewLocalStorage devolvió error: %v", err)
	}

	if _, err := s.Save(context.Background(), "foto.jpg", readerQueSiempreFalla{}); err == nil {
		t.Fatal("Save debería propagar un error de lectura del reader de origen")
	}
}
