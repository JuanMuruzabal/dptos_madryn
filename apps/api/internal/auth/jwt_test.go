package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

func TestGenerateAndParseToken_RoundTrip(t *testing.T) {
	usuarioID := uuid.New()
	token, err := GenerateToken("secreto-de-test", usuarioID, "administrador")
	if err != nil {
		t.Fatalf("GenerateToken devolvió error: %v", err)
	}

	claims, err := ParseToken("secreto-de-test", token)
	if err != nil {
		t.Fatalf("ParseToken devolvió error para un token recién generado: %v", err)
	}
	if claims.Subject != usuarioID.String() {
		t.Fatalf("Subject = %q, esperaba %q", claims.Subject, usuarioID.String())
	}
	if claims.Rol != "administrador" {
		t.Fatalf("Rol = %q, esperaba %q", claims.Rol, "administrador")
	}
	if claims.ExpiresAt == nil || !claims.ExpiresAt.After(time.Now()) {
		t.Fatal("ExpiresAt debería estar en el futuro para un token recién generado")
	}
}

func TestParseToken_RechazaSecretoIncorrecto(t *testing.T) {
	token, err := GenerateToken("secreto-correcto", uuid.New(), "cliente")
	if err != nil {
		t.Fatalf("GenerateToken devolvió error: %v", err)
	}

	if _, err := ParseToken("secreto-incorrecto", token); err == nil {
		t.Fatal("ParseToken debería rechazar un token firmado con otro secreto")
	}
}

func TestParseToken_RechazaTokenExpirado(t *testing.T) {
	ya := time.Now().Add(-1 * time.Hour)
	claims := Claims{
		Rol: "cliente",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   uuid.New().String(),
			IssuedAt:  jwt.NewNumericDate(ya.Add(-1 * time.Hour)),
			ExpiresAt: jwt.NewNumericDate(ya),
		},
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte("secreto"))
	if err != nil {
		t.Fatalf("no se pudo firmar el token de prueba: %v", err)
	}

	if _, err := ParseToken("secreto", token); err == nil {
		t.Fatal("ParseToken debería rechazar un token vencido")
	}
}

func TestParseToken_RechazaTokenMalformado(t *testing.T) {
	if _, err := ParseToken("secreto", "esto-no-es-un-jwt"); err == nil {
		t.Fatal("ParseToken debería rechazar un string que no es un JWT válido")
	}
}

// Regresión: ParseToken chequea explícitamente que el método de firma sea
// HMAC (evita el ataque clásico de JWT donde alguien manda un token con
// alg=none y el servidor lo acepta como válido sin verificar nada).
func TestParseToken_RechazaAlgoritmoNone(t *testing.T) {
	claims := Claims{
		Rol: "administrador",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   uuid.New().String(),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodNone, claims).SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatalf("no se pudo generar el token alg=none de prueba: %v", err)
	}

	if _, err := ParseToken("secreto", token); err == nil {
		t.Fatal("ParseToken debería rechazar un token con alg=none, sin importar el secreto")
	}
}
