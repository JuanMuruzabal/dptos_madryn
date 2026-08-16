package storage

import (
	"context"
	"fmt"
	"io"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
)

// s3PutObjectAPI es el subconjunto de *s3.Client que R2Storage necesita —
// permite inyectar un cliente falso en los tests sin pegarle a un bucket
// real (mismo motivo que testdb usa Postgres real para todo LO DEMÁS:
// acá al revés, un mock de un solo método es más simple y suficiente que
// levantar infraestructura de R2 de verdad para un test unitario).
type s3PutObjectAPI interface {
	PutObject(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error)
}

// R2Storage guarda archivos en un bucket de Cloudflare R2 (API
// compatible con S3) — implementación de producción de Storage, ver
// TR-013/TR-041 en docs/tradeoffs.md. R2 no cobra egress, a diferencia
// de S3 — más barato para servir fotos públicas de alto tráfico de
// lectura como estas.
type R2Storage struct {
	client    s3PutObjectAPI
	bucket    string
	publicURL string
}

// NewR2Storage arma un cliente S3 apuntado al endpoint de R2 de la
// cuenta (`https://<accountID>.r2.cloudflarestorage.com`) con
// credenciales estáticas (Access Key/Secret Key de un R2 API Token,
// nunca las claves globales de la cuenta). publicURL es la URL pública
// del bucket (el dominio r2.dev que da Cloudflare, o un dominio propio
// conectado más adelante) — sin barra final.
func NewR2Storage(ctx context.Context, accountID, accessKeyID, secretAccessKey, bucket, publicURL string) (*R2Storage, error) {
	endpoint := fmt.Sprintf("https://%s.r2.cloudflarestorage.com", accountID)

	cfg, err := awsconfig.LoadDefaultConfig(ctx,
		awsconfig.WithRegion("auto"), // R2 no tiene regiones — "auto" es el valor que documenta Cloudflare
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKeyID, secretAccessKey, "")),
	)
	if err != nil {
		return nil, fmt.Errorf("cargando config de AWS SDK para R2: %w", err)
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(endpoint)
		// R2 no soporta el addressing virtual-hosted-style que S3 usa por
		// default (bucket.s3.amazonaws.com) — path-style es lo que
		// Cloudflare documenta para el SDK de S3 contra R2.
		o.UsePathStyle = true
	})

	return &R2Storage{
		client:    client,
		bucket:    bucket,
		publicURL: strings.TrimSuffix(publicURL, "/"),
	}, nil
}

// Save sube el archivo con un nombre aleatorio (mismo criterio que
// LocalStorage: nunca el nombre que manda el cliente, evita
// colisiones/path traversal) y devuelve la URL pública.
func (s *R2Storage) Save(ctx context.Context, filename string, r io.Reader) (string, error) {
	ext := strings.ToLower(extOf(filename))
	safeName := uuid.NewString() + ext

	// R2 (como S3) necesita saber el tamaño del body salvo que se le pase
	// un io.ReadSeeker, o hace streaming en chunks con checksums que
	// algunos clientes no soportan bien — leer todo a memoria es
	// aceptable acá: los handlers que llaman a Save ya validan un límite
	// de tamaño de archivo antes (ver alojamientos.go/imagenes.go).
	data, err := io.ReadAll(r)
	if err != nil {
		return "", fmt.Errorf("leyendo archivo: %w", err)
	}

	_, err = s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(safeName),
		Body:        strings.NewReader(string(data)),
		ContentType: aws.String(contentTypeFor(ext)),
	})
	if err != nil {
		return "", fmt.Errorf("subiendo archivo a R2: %w", err)
	}

	return s.publicURL + "/" + safeName, nil
}

func extOf(filename string) string {
	i := strings.LastIndexByte(filename, '.')
	if i < 0 {
		return ""
	}
	return filename[i:]
}

// contentTypeFor cubre los formatos que los handlers ya validan al
// aceptar un upload (jpeg/png/webp para fotos, mp4/webm para video) —
// ver la constante allowedImageTypes/allowedVideoTypes en alojamientos.go.
// Sin esto, R2 serviría todo como application/octet-stream y el
// navegador fuerza la descarga en vez de mostrar la imagen/video inline.
func contentTypeFor(ext string) string {
	switch ext {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".webp":
		return "image/webp"
	case ".mp4":
		return "video/mp4"
	case ".webm":
		return "video/webm"
	case ".mov":
		return "video/quicktime"
	default:
		return "application/octet-stream"
	}
}
