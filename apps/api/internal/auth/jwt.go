// Package auth emite y valida los JWT de sesión emitidos por el backend.
package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// TTL de sesión. Suficiente para el MVP; revisar si hace falta refresh
// token cuando se implemente el flujo completo de auth en Sprint 1 (T1.2).
const tokenTTL = 7 * 24 * time.Hour

// Claims son los datos propios que viajan en el JWT, además de los
// registrados estándar (exp, iat, sub).
type Claims struct {
	Rol string `json:"rol"`
	jwt.RegisteredClaims
}

// GenerateToken firma un JWT para el usuario dado.
func GenerateToken(secret string, usuarioID uuid.UUID, rol string) (string, error) {
	now := time.Now()
	claims := Claims{
		Rol: rol,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   usuarioID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(tokenTTL)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// ParseToken valida la firma y expiración de un JWT y devuelve sus claims.
func ParseToken(secret, tokenStr string) (*Claims, error) {
	claims := &Claims{}

	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("método de firma inesperado")
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, errors.New("token inválido")
	}

	return claims, nil
}
