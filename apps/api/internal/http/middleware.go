package http

import (
	"context"
	"net/http"
	"strings"

	"turismo-marcuzzi/api/internal/auth"
)

type contextKey string

const claimsContextKey contextKey = "claims"

// requireAuth exige un JWT válido en el header Authorization: Bearer <token>
// y deja sus claims en el contexto del request para los handlers de abajo.
func requireAuth(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			token, ok := strings.CutPrefix(header, "Bearer ")
			if !ok || token == "" {
				writeError(w, http.StatusUnauthorized, "falta el token de autenticación")
				return
			}

			claims, err := auth.ParseToken(jwtSecret, token)
			if err != nil {
				writeError(w, http.StatusUnauthorized, "token inválido o expirado")
				return
			}

			ctx := context.WithValue(r.Context(), claimsContextKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func claimsFromContext(r *http.Request) (*auth.Claims, bool) {
	claims, ok := r.Context().Value(claimsContextKey).(*auth.Claims)
	return claims, ok
}

// isAdminCaller intenta decodificar un JWT de administrador del header
// Authorization SIN exigirlo — a diferencia de requireAuth/requireRole, que
// cortan la request con 401/403. Sirve para endpoints públicos que quieren
// mostrarle algo de más a un admin sin dejar de ser públicos para todos los
// demás (T4.2: GET /alojamientos incluye los inactivos solo para el panel).
// Cualquier token ausente/inválido/no-admin simplemente da false, nunca
// hace fallar la respuesta.
func isAdminCaller(r *http.Request, jwtSecret string) bool {
	header := r.Header.Get("Authorization")
	token, ok := strings.CutPrefix(header, "Bearer ")
	if !ok || token == "" {
		return false
	}
	claims, err := auth.ParseToken(jwtSecret, token)
	return err == nil && claims.Rol == "administrador"
}

// requireRole exige que el usuario autenticado tenga el rol dado. Debe
// montarse después de requireAuth en la cadena (necesita claims en el
// contexto). Protege las rutas de escritura de alojamiento (T2.1) y va a
// proteger el resto del panel admin cuando exista (Sprint 4, FR-8).
func requireRole(role string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := claimsFromContext(r)
			if !ok {
				writeError(w, http.StatusUnauthorized, "falta el token de autenticación")
				return
			}
			if claims.Rol != role {
				writeError(w, http.StatusForbidden, "no tenés permisos para esta acción")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
