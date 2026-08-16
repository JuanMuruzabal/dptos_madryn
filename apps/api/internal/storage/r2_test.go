package storage

import (
	"context"
	"errors"
	"io"
	"strings"
	"testing"

	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// fakeS3 implementa s3PutObjectAPI sin pegarle a R2 de verdad — guarda lo
// último que se subió para poder inspeccionarlo desde el test.
type fakeS3 struct {
	putErr     error
	lastBucket string
	lastKey    string
	lastBody   string
	lastCT     string
	callCount  int
}

func (f *fakeS3) PutObject(_ context.Context, params *s3.PutObjectInput, _ ...func(*s3.Options)) (*s3.PutObjectOutput, error) {
	f.callCount++
	if f.putErr != nil {
		return nil, f.putErr
	}
	f.lastBucket = *params.Bucket
	f.lastKey = *params.Key
	if params.ContentType != nil {
		f.lastCT = *params.ContentType
	}
	body, _ := io.ReadAll(params.Body)
	f.lastBody = string(body)
	return &s3.PutObjectOutput{}, nil
}

func TestR2Storage_Save_SubeElArchivoYDevuelveLaURLPublica(t *testing.T) {
	fake := &fakeS3{}
	store := &R2Storage{client: fake, bucket: "turismo-marcuzzi-uploads", publicURL: "https://pub-xxxx.r2.dev"}

	url, err := store.Save(context.Background(), "foto.jpg", strings.NewReader("contenido de prueba"))
	if err != nil {
		t.Fatalf("Save devolvió error: %v", err)
	}

	if fake.callCount != 1 {
		t.Fatalf("PutObject se llamó %d veces, esperaba 1", fake.callCount)
	}
	if fake.lastBucket != "turismo-marcuzzi-uploads" {
		t.Errorf("bucket = %q, esperaba %q", fake.lastBucket, "turismo-marcuzzi-uploads")
	}
	if fake.lastBody != "contenido de prueba" {
		t.Errorf("body subido = %q, esperaba %q", fake.lastBody, "contenido de prueba")
	}
	if !strings.HasPrefix(url, "https://pub-xxxx.r2.dev/") {
		t.Errorf("url = %q, esperaba que empiece con %q", url, "https://pub-xxxx.r2.dev/")
	}
	if !strings.HasSuffix(url, ".jpg") {
		t.Errorf("url = %q, esperaba que termine en .jpg (extensión del archivo original)", url)
	}
}

func TestR2Storage_Save_NuncaUsaElNombreOriginalComoKey(t *testing.T) {
	fake := &fakeS3{}
	store := &R2Storage{client: fake, bucket: "b", publicURL: "https://pub.r2.dev"}

	if _, err := store.Save(context.Background(), "../../../etc/passwd.png", strings.NewReader("x")); err != nil {
		t.Fatalf("Save devolvió error: %v", err)
	}

	if strings.Contains(fake.lastKey, "..") || strings.Contains(fake.lastKey, "passwd") {
		t.Errorf("key subida = %q, no debería contener el nombre/ruta original", fake.lastKey)
	}
	if !strings.HasSuffix(fake.lastKey, ".png") {
		t.Errorf("key = %q, esperaba que conserve la extensión .png", fake.lastKey)
	}
}

func TestR2Storage_Save_DosArchivosGeneranKeysDistintas(t *testing.T) {
	fake := &fakeS3{}
	store := &R2Storage{client: fake, bucket: "b", publicURL: "https://pub.r2.dev"}

	url1, err := store.Save(context.Background(), "a.jpg", strings.NewReader("1"))
	if err != nil {
		t.Fatalf("Save #1 devolvió error: %v", err)
	}
	url2, err := store.Save(context.Background(), "a.jpg", strings.NewReader("2"))
	if err != nil {
		t.Fatalf("Save #2 devolvió error: %v", err)
	}

	if url1 == url2 {
		t.Errorf("dos uploads con el mismo nombre original produjeron la misma URL: %q", url1)
	}
}

func TestR2Storage_Save_PropagaElErrorDePutObject(t *testing.T) {
	wantErr := errors.New("bucket no existe")
	fake := &fakeS3{putErr: wantErr}
	store := &R2Storage{client: fake, bucket: "b", publicURL: "https://pub.r2.dev"}

	_, err := store.Save(context.Background(), "a.jpg", strings.NewReader("x"))
	if err == nil {
		t.Fatal("Save no devolvió error, esperaba que propague el de PutObject")
	}
	if !errors.Is(err, wantErr) {
		t.Errorf("error = %v, esperaba que envuelva %v", err, wantErr)
	}
}

func TestR2Storage_Save_ContentTypeSegunLaExtension(t *testing.T) {
	cases := []struct {
		filename string
		wantCT   string
	}{
		{"a.jpg", "image/jpeg"},
		{"a.jpeg", "image/jpeg"},
		{"a.png", "image/png"},
		{"a.webp", "image/webp"},
		{"a.mp4", "video/mp4"},
		{"a.webm", "video/webm"},
		{"a.mov", "video/quicktime"},
		{"a.MP4", "video/mp4"}, // no case-sensitive
		{"sin-extension", "application/octet-stream"},
	}

	for _, c := range cases {
		fake := &fakeS3{}
		store := &R2Storage{client: fake, bucket: "b", publicURL: "https://pub.r2.dev"}
		if _, err := store.Save(context.Background(), c.filename, strings.NewReader("x")); err != nil {
			t.Fatalf("Save(%q) devolvió error: %v", c.filename, err)
		}
		if fake.lastCT != c.wantCT {
			t.Errorf("Save(%q): ContentType = %q, esperaba %q", c.filename, fake.lastCT, c.wantCT)
		}
	}
}

// El recorte de la barra final pasa en el constructor (NewR2Storage), no
// en Save — construir el store a mano acá con el campo ya recortado
// refleja el invariante real (cualquier *R2Storage vivo salió de
// NewR2Storage) sin duplicar esa lógica en Save.
func TestR2Storage_Save_NoAgregaDobleBarraConUnPublicURLYaRecortado(t *testing.T) {
	fake := &fakeS3{}
	store := &R2Storage{client: fake, bucket: "b", publicURL: "https://pub.r2.dev"}

	url, err := store.Save(context.Background(), "a.jpg", strings.NewReader("x"))
	if err != nil {
		t.Fatalf("Save devolvió error: %v", err)
	}
	if strings.Contains(url, "r2.dev//") {
		t.Errorf("url = %q, tiene doble barra después del dominio", url)
	}
}

func TestNewR2Storage_ArmaElClienteSinError(t *testing.T) {
	// No pega contra R2 de verdad (LoadDefaultConfig no hace I/O de red
	// para credenciales estáticas) — solo confirma que el constructor no
	// explota con datos válidos y que arma el endpoint/bucket/publicURL.
	store, err := NewR2Storage(context.Background(), "acc123", "key", "secret", "mi-bucket", "https://pub.r2.dev/")
	if err != nil {
		t.Fatalf("NewR2Storage devolvió error: %v", err)
	}
	if store.bucket != "mi-bucket" {
		t.Errorf("bucket = %q, esperaba %q", store.bucket, "mi-bucket")
	}
	if store.publicURL != "https://pub.r2.dev" {
		t.Errorf("publicURL = %q, esperaba sin la barra final", store.publicURL)
	}
	if store.client == nil {
		t.Error("client no debería ser nil")
	}
}
