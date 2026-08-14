package http

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"

	"turismo-marcuzzi/api/internal/auth"
	"turismo-marcuzzi/api/internal/clock"
	"turismo-marcuzzi/api/internal/db"
	"turismo-marcuzzi/api/internal/email"
	"turismo-marcuzzi/api/internal/testdb"
)

func newReservaHandler(t *testing.T) (*reservaHandler, *gorm.DB) {
	t.Helper()
	tx := testdb.New(t)
	return &reservaHandler{db: tx, email: email.LogSender{}}, tx
}

// reqConClaims mete claims directo en el contexto, como si requireAuth ya
// hubiera corrido — los handlers de reservas los leen con
// claimsFromContext(r), que sin esto no encuentra nada.
func reqConClaims(method, target string, body io.Reader, params map[string]string, claims *auth.Claims) *http.Request {
	req := reqConParam(method, target, body, params)
	if claims == nil {
		return req
	}
	return req.WithContext(context.WithValue(req.Context(), claimsContextKey, claims))
}

func claimsDe(usuarioID uuid.UUID, rol string) *auth.Claims {
	return &auth.Claims{
		Rol: rol,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   usuarioID.String(),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	}
}

func crearReservaValida() crearReservaRequest {
	return crearReservaRequest{
		FechaInicio:      clock.Today().AddDate(0, 0, 5).Format(dateLayout),
		FechaFin:         clock.Today().AddDate(0, 0, 8).Format(dateLayout),
		ContactoNombre:   "Ana",
		ContactoApellido: "Test",
		ContactoDNI:      "12345678",
		ContactoEmail:    "ana@example.com",
		ContactoTelefono: "1122334455",
	}
}

// --- validateContacto() ---

func TestCrearReservaRequest_ValidateContacto(t *testing.T) {
	casos := []struct {
		nombre      string
		mut         func(*crearReservaRequest)
		quiereError bool
	}{
		{"válido", func(r *crearReservaRequest) {}, false},
		{"nombre vacío", func(r *crearReservaRequest) { r.ContactoNombre = "  " }, true},
		{"apellido vacío", func(r *crearReservaRequest) { r.ContactoApellido = "" }, true},
		{"dni corto", func(r *crearReservaRequest) { r.ContactoDNI = "123" }, true},
		{"dni con letras", func(r *crearReservaRequest) { r.ContactoDNI = "abcdefgh" }, true},
		{"dni de 6 dígitos (mínimo)", func(r *crearReservaRequest) { r.ContactoDNI = "123456" }, false},
		{"dni de 9 dígitos (máximo)", func(r *crearReservaRequest) { r.ContactoDNI = "123456789" }, false},
		{"dni de 10 dígitos", func(r *crearReservaRequest) { r.ContactoDNI = "1234567890" }, true},
		{"email inválido", func(r *crearReservaRequest) { r.ContactoEmail = "no-es-un-email" }, true},
		{"teléfono vacío", func(r *crearReservaRequest) { r.ContactoTelefono = "" }, true},
	}

	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			req := crearReservaValida()
			c.mut(&req)
			msg := req.validateContacto()
			if c.quiereError && msg == "" {
				t.Fatal("esperaba un mensaje de error")
			}
			if !c.quiereError && msg != "" {
				t.Fatalf("no esperaba error, dio: %q", msg)
			}
		})
	}
}

// --- crear ---

func TestCrear_ReservaExitosa(t *testing.T) {
	h, tx := newReservaHandler(t)
	usuario := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, func(al *db.Alojamiento) { al.PrecioNoche = 1000 })

	req := reqConClaims(http.MethodPost, "/alojamientos/"+a.ID.String()+"/reservas",
		jsonBody(t, crearReservaValida()), map[string]string{"id": a.ID.String()}, claimsDe(usuario.ID, "cliente"))
	rec := httptest.NewRecorder()
	h.crear(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusCreated, rec.Body.String())
	}
	var resp reservaResponse
	mustUnmarshal(t, rec.Body.Bytes(), &resp)
	// 3 noches (día 5 a día 8) * 1000 = 3000.
	if resp.Total != 3000 {
		t.Fatalf("Total = %v, esperaba 3000 (3 noches x 1000)", resp.Total)
	}
	if resp.Estado != "pendiente" {
		t.Fatalf("Estado = %q, esperaba %q", resp.Estado, "pendiente")
	}
}

func TestCrear_AdminNoPuedeReservar(t *testing.T) {
	h, tx := newReservaHandler(t)
	usuario := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)

	req := reqConClaims(http.MethodPost, "/alojamientos/"+a.ID.String()+"/reservas",
		jsonBody(t, crearReservaValida()), map[string]string{"id": a.ID.String()}, claimsDe(usuario.ID, "administrador"))
	rec := httptest.NewRecorder()
	h.crear(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusForbidden)
	}
}

func TestCrear_SinClaimsDaUnauthorized(t *testing.T) {
	h, tx := newReservaHandler(t)
	a := crearAlojamientoDePrueba(t, tx, nil)

	req := reqConClaims(http.MethodPost, "/alojamientos/"+a.ID.String()+"/reservas",
		jsonBody(t, crearReservaValida()), map[string]string{"id": a.ID.String()}, nil)
	rec := httptest.NewRecorder()
	h.crear(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestCrear_AlojamientoInexistenteDaNotFound(t *testing.T) {
	h, tx := newReservaHandler(t)
	usuario := crearUsuarioDePrueba(t, tx)
	id := uuid.New().String()

	req := reqConClaims(http.MethodPost, "/alojamientos/"+id+"/reservas",
		jsonBody(t, crearReservaValida()), map[string]string{"id": id}, claimsDe(usuario.ID, "cliente"))
	rec := httptest.NewRecorder()
	h.crear(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusNotFound)
	}
}

func TestCrear_AlojamientoInactivoDaNotFound(t *testing.T) {
	h, tx := newReservaHandler(t)
	usuario := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, func(al *db.Alojamiento) { al.Activo = false })

	req := reqConClaims(http.MethodPost, "/alojamientos/"+a.ID.String()+"/reservas",
		jsonBody(t, crearReservaValida()), map[string]string{"id": a.ID.String()}, claimsDe(usuario.ID, "cliente"))
	rec := httptest.NewRecorder()
	h.crear(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, esperaba %d — un alojamiento de baja no se puede reservar", rec.Code, http.StatusNotFound)
	}
}

func TestCrear_FechasInvalidasDanBadRequest(t *testing.T) {
	h, tx := newReservaHandler(t)
	usuario := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)

	req := crearReservaValida()
	req.FechaInicio = "no-es-una-fecha"
	httpReq := reqConClaims(http.MethodPost, "/alojamientos/"+a.ID.String()+"/reservas",
		jsonBody(t, req), map[string]string{"id": a.ID.String()}, claimsDe(usuario.ID, "cliente"))
	rec := httptest.NewRecorder()
	h.crear(rec, httpReq)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

func TestCrear_SinUnDiaDeAnticipacionDaBadRequest(t *testing.T) {
	h, tx := newReservaHandler(t)
	usuario := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)

	req := crearReservaValida()
	req.FechaInicio = clock.Today().Format(dateLayout) // hoy mismo, no alcanza
	req.FechaFin = clock.Today().AddDate(0, 0, 3).Format(dateLayout)
	httpReq := reqConClaims(http.MethodPost, "/alojamientos/"+a.ID.String()+"/reservas",
		jsonBody(t, req), map[string]string{"id": a.ID.String()}, claimsDe(usuario.ID, "cliente"))
	rec := httptest.NewRecorder()
	h.crear(rec, httpReq)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

func TestCrear_CheckoutNoPosteriorAlCheckinDaBadRequest(t *testing.T) {
	h, tx := newReservaHandler(t)
	usuario := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)

	req := crearReservaValida()
	req.FechaInicio = clock.Today().AddDate(0, 0, 5).Format(dateLayout)
	req.FechaFin = clock.Today().AddDate(0, 0, 5).Format(dateLayout) // igual al check-in
	httpReq := reqConClaims(http.MethodPost, "/alojamientos/"+a.ID.String()+"/reservas",
		jsonBody(t, req), map[string]string{"id": a.ID.String()}, claimsDe(usuario.ID, "cliente"))
	rec := httptest.NewRecorder()
	h.crear(rec, httpReq)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

func TestCrear_DatosDeContactoInvalidosDanBadRequest(t *testing.T) {
	h, tx := newReservaHandler(t)
	usuario := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)

	req := crearReservaValida()
	req.ContactoDNI = "abc"
	httpReq := reqConClaims(http.MethodPost, "/alojamientos/"+a.ID.String()+"/reservas",
		jsonBody(t, req), map[string]string{"id": a.ID.String()}, claimsDe(usuario.ID, "cliente"))
	rec := httptest.NewRecorder()
	h.crear(rec, httpReq)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

// Solapamiento dentro de la misma transacción: Postgres ya rechaza el
// segundo INSERT contra el exclusion constraint aunque la transacción
// todavía no haya hecho commit (ve sus propias filas). El test de
// concurrencia real con dos transacciones separadas está más abajo.
func TestCrear_FechasSolapadasDaConflict(t *testing.T) {
	h, tx := newReservaHandler(t)
	usuario1 := crearUsuarioDePrueba(t, tx)
	usuario2 := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)

	primera := reqConClaims(http.MethodPost, "/alojamientos/"+a.ID.String()+"/reservas",
		jsonBody(t, crearReservaValida()), map[string]string{"id": a.ID.String()}, claimsDe(usuario1.ID, "cliente"))
	rec1 := httptest.NewRecorder()
	h.crear(rec1, primera)
	if rec1.Code != http.StatusCreated {
		t.Fatalf("la primera reserva debería crearse bien, status = %d — body: %s", rec1.Code, rec1.Body.String())
	}

	segunda := reqConClaims(http.MethodPost, "/alojamientos/"+a.ID.String()+"/reservas",
		jsonBody(t, crearReservaValida()), map[string]string{"id": a.ID.String()}, claimsDe(usuario2.ID, "cliente"))
	rec2 := httptest.NewRecorder()
	h.crear(rec2, segunda)

	if rec2.Code != http.StatusConflict {
		t.Fatalf("status = %d, esperaba %d (fechas solapadas)", rec2.Code, http.StatusConflict)
	}
}

// Test de concurrencia real (T12.10, mismo espíritu que T0.3): dos
// transacciones INDEPENDIENTES (no la misma, a diferencia del test de
// arriba) insertando reservas con fechas solapadas sobre el mismo
// alojamiento al mismo tiempo — exactamente una tiene que ganar. Usa
// testdb.Shared (conexión real, sin el wrapper de rollback automático)
// porque necesita que las dos transacciones compitan de verdad.
func TestCrear_ConcurrenciaRealSoloUnaGana(t *testing.T) {
	shared := testdb.Shared(t)

	var alojamientoID uuid.UUID
	var usuario1ID, usuario2ID uuid.UUID
	setupTx := shared.Begin()
	a := db.Alojamiento{Nombre: "Concurrencia", Lat: -42.7, Lng: -65.0, PrecioNoche: 1000, Capacidad: 2, Activo: true}
	if err := setupTx.Create(&a).Error; err != nil {
		t.Fatalf("no se pudo crear el alojamiento: %v", err)
	}
	u1 := db.Usuario{Nombre: "U1", Email: uuid.NewString() + "@example.com", PasswordHash: "x", Rol: "cliente"}
	u2 := db.Usuario{Nombre: "U2", Email: uuid.NewString() + "@example.com", PasswordHash: "x", Rol: "cliente"}
	if err := setupTx.Create(&u1).Error; err != nil {
		t.Fatalf("no se pudo crear u1: %v", err)
	}
	if err := setupTx.Create(&u2).Error; err != nil {
		t.Fatalf("no se pudo crear u2: %v", err)
	}
	if err := setupTx.Commit().Error; err != nil {
		t.Fatalf("no se pudo commitear el setup: %v", err)
	}
	alojamientoID, usuario1ID, usuario2ID = a.ID, u1.ID, u2.ID

	t.Cleanup(func() {
		cleanup := shared.Begin()
		cleanup.Exec("DELETE FROM reservas WHERE alojamiento_id = ?", alojamientoID)
		cleanup.Exec("DELETE FROM alojamientos WHERE id = ?", alojamientoID)
		cleanup.Exec("DELETE FROM usuarios WHERE id IN ?", []uuid.UUID{usuario1ID, usuario2ID})
		cleanup.Commit()
	})

	intentar := func(usuarioID uuid.UUID) (int, error) {
		h := &reservaHandler{db: shared, email: email.LogSender{}}
		req := reqConClaims(http.MethodPost, "/alojamientos/"+alojamientoID.String()+"/reservas",
			jsonBody(t, crearReservaValida()), map[string]string{"id": alojamientoID.String()}, claimsDe(usuarioID, "cliente"))
		rec := httptest.NewRecorder()
		h.crear(rec, req)
		return rec.Code, nil
	}

	var wg sync.WaitGroup
	codigos := make([]int, 2)
	wg.Add(2)
	go func() { defer wg.Done(); codigos[0], _ = intentar(usuario1ID) }()
	go func() { defer wg.Done(); codigos[1], _ = intentar(usuario2ID) }()
	wg.Wait()

	exitos, conflictos := 0, 0
	for _, c := range codigos {
		switch c {
		case http.StatusCreated:
			exitos++
		case http.StatusConflict:
			conflictos++
		default:
			t.Fatalf("código inesperado: %d", c)
		}
	}
	if exitos != 1 || conflictos != 1 {
		t.Fatalf("esperaba exactamente 1 éxito y 1 conflicto entre las dos reservas concurrentes, dio %d éxitos y %d conflictos (códigos: %v)", exitos, conflictos, codigos)
	}
}

// --- misReservas ---

func TestMisReservas_DevuelveSoloLasDelUsuario(t *testing.T) {
	h, tx := newReservaHandler(t)
	u1 := crearUsuarioDePrueba(t, tx)
	u2 := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)

	inicio, fin := clock.Today().AddDate(0, 0, 5), clock.Today().AddDate(0, 0, 8)
	tx.Create(&db.Reserva{UsuarioID: u1.ID, AlojamientoID: &a.ID, Tipo: "alojamiento", Estado: "pendiente", FechaInicio: &inicio, FechaFin: &fin})
	inicio2, fin2 := clock.Today().AddDate(0, 0, 20), clock.Today().AddDate(0, 0, 22)
	tx.Create(&db.Reserva{UsuarioID: u2.ID, AlojamientoID: &a.ID, Tipo: "alojamiento", Estado: "pendiente", FechaInicio: &inicio2, FechaFin: &fin2})

	req := reqConClaims(http.MethodGet, "/me/reservas", nil, nil, claimsDe(u1.ID, "cliente"))
	rec := httptest.NewRecorder()
	h.misReservas(rec, req)

	var resp []reservaResponse
	mustUnmarshal(t, rec.Body.Bytes(), &resp)
	if len(resp) != 1 {
		t.Fatalf("esperaba 1 reserva (solo la de u1), dio %d", len(resp))
	}
}

func TestMisReservas_ExcluyeBloqueosAdmin(t *testing.T) {
	h, tx := newReservaHandler(t)
	admin := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)

	inicio, fin := clock.Today().AddDate(0, 0, 5), clock.Today().AddDate(0, 0, 8)
	tx.Create(&db.Reserva{
		UsuarioID: admin.ID, AlojamientoID: &a.ID, Tipo: "alojamiento", Estado: "confirmada",
		FechaInicio: &inicio, FechaFin: &fin, EsBloqueoAdmin: true,
	})

	req := reqConClaims(http.MethodGet, "/me/reservas", nil, nil, claimsDe(admin.ID, "administrador"))
	rec := httptest.NewRecorder()
	h.misReservas(rec, req)

	var resp []reservaResponse
	mustUnmarshal(t, rec.Body.Bytes(), &resp)
	if len(resp) != 0 {
		t.Fatalf("un bloqueo manual no debería aparecer en /me/reservas, dio %d resultados", len(resp))
	}
}

func TestMisReservas_SinClaimsDaUnauthorized(t *testing.T) {
	h, _ := newReservaHandler(t)
	rec := httptest.NewRecorder()
	h.misReservas(rec, reqConClaims(http.MethodGet, "/me/reservas", nil, nil, nil))

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusUnauthorized)
	}
}

// --- marcarContactado ---

func TestMarcarContactado_Exitoso(t *testing.T) {
	h, tx := newReservaHandler(t)
	u := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)
	inicio, fin := clock.Today().AddDate(0, 0, 5), clock.Today().AddDate(0, 0, 8)
	reserva := db.Reserva{UsuarioID: u.ID, AlojamientoID: &a.ID, Tipo: "alojamiento", Estado: "pendiente", FechaInicio: &inicio, FechaFin: &fin}
	tx.Create(&reserva)

	req := reqConClaims(http.MethodPost, "/reservas/"+reserva.ID.String()+"/contacto", nil,
		map[string]string{"id": reserva.ID.String()}, claimsDe(u.ID, "cliente"))
	rec := httptest.NewRecorder()
	h.marcarContactado(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusNoContent)
	}
	var recargada db.Reserva
	tx.First(&recargada, "id = ?", reserva.ID)
	if recargada.ContactadoEn == nil {
		t.Fatal("ContactadoEn debería quedar seteado")
	}
}

// No se puede apagar el timer de la reserva de otro usuario adivinando el id.
func TestMarcarContactado_DeOtroUsuarioDaNotFound(t *testing.T) {
	h, tx := newReservaHandler(t)
	dueño := crearUsuarioDePrueba(t, tx)
	otro := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)
	inicio, fin := clock.Today().AddDate(0, 0, 5), clock.Today().AddDate(0, 0, 8)
	reserva := db.Reserva{UsuarioID: dueño.ID, AlojamientoID: &a.ID, Tipo: "alojamiento", Estado: "pendiente", FechaInicio: &inicio, FechaFin: &fin}
	tx.Create(&reserva)

	req := reqConClaims(http.MethodPost, "/reservas/"+reserva.ID.String()+"/contacto", nil,
		map[string]string{"id": reserva.ID.String()}, claimsDe(otro.ID, "cliente"))
	rec := httptest.NewRecorder()
	h.marcarContactado(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusNotFound)
	}
}

func TestMarcarContactado_IdInvalidoDaBadRequest(t *testing.T) {
	h, tx := newReservaHandler(t)
	u := crearUsuarioDePrueba(t, tx)
	req := reqConClaims(http.MethodPost, "/reservas/x/contacto", nil,
		map[string]string{"id": "no-es-un-uuid"}, claimsDe(u.ID, "cliente"))
	rec := httptest.NewRecorder()
	h.marcarContactado(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

// --- alojamientoVigente ---

func TestAlojamientoVigente_TrueConReservaConfirmadaVigente(t *testing.T) {
	h, tx := newReservaHandler(t)
	u := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)
	inicio, fin := clock.Today().AddDate(0, 0, -2), clock.Today().AddDate(0, 0, 3)
	tx.Create(&db.Reserva{UsuarioID: u.ID, AlojamientoID: &a.ID, Tipo: "alojamiento", Estado: "confirmada", FechaInicio: &inicio, FechaFin: &fin})

	req := reqConClaims(http.MethodGet, "/me/alojamiento-vigente", nil, nil, claimsDe(u.ID, "cliente"))
	rec := httptest.NewRecorder()
	h.alojamientoVigente(rec, req)

	var resp map[string]bool
	mustUnmarshal(t, rec.Body.Bytes(), &resp)
	if !resp["vigente"] {
		t.Fatal("esperaba vigente=true")
	}
}

func TestAlojamientoVigente_FalseSiVencio(t *testing.T) {
	h, tx := newReservaHandler(t)
	u := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)
	inicio, fin := clock.Today().AddDate(0, 0, -10), clock.Today().AddDate(0, 0, -1)
	tx.Create(&db.Reserva{UsuarioID: u.ID, AlojamientoID: &a.ID, Tipo: "alojamiento", Estado: "confirmada", FechaInicio: &inicio, FechaFin: &fin})

	req := reqConClaims(http.MethodGet, "/me/alojamiento-vigente", nil, nil, claimsDe(u.ID, "cliente"))
	rec := httptest.NewRecorder()
	h.alojamientoVigente(rec, req)

	var resp map[string]bool
	mustUnmarshal(t, rec.Body.Bytes(), &resp)
	if resp["vigente"] {
		t.Fatal("una estadía ya terminada no debería contar como vigente")
	}
}

func TestAlojamientoVigente_FalseSiSoloPendiente(t *testing.T) {
	h, tx := newReservaHandler(t)
	u := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)
	inicio, fin := clock.Today().AddDate(0, 0, 5), clock.Today().AddDate(0, 0, 8)
	tx.Create(&db.Reserva{UsuarioID: u.ID, AlojamientoID: &a.ID, Tipo: "alojamiento", Estado: "pendiente", FechaInicio: &inicio, FechaFin: &fin})

	req := reqConClaims(http.MethodGet, "/me/alojamiento-vigente", nil, nil, claimsDe(u.ID, "cliente"))
	rec := httptest.NewRecorder()
	h.alojamientoVigente(rec, req)

	var resp map[string]bool
	mustUnmarshal(t, rec.Body.Bytes(), &resp)
	if resp["vigente"] {
		t.Fatal("una reserva todavía pendiente (no confirmada) no debería contar como vigente")
	}
}

func TestAlojamientoVigente_SinClaimsDaUnauthorized(t *testing.T) {
	h, _ := newReservaHandler(t)
	rec := httptest.NewRecorder()
	h.alojamientoVigente(rec, reqConClaims(http.MethodGet, "/me/alojamiento-vigente", nil, nil, nil))

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusUnauthorized)
	}
}

// --- listAdmin ---

func TestListAdmin_ExcluyeBloqueos(t *testing.T) {
	h, tx := newReservaHandler(t)
	u := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)
	inicio, fin := clock.Today().AddDate(0, 0, 5), clock.Today().AddDate(0, 0, 8)
	tx.Create(&db.Reserva{UsuarioID: u.ID, AlojamientoID: &a.ID, Tipo: "alojamiento", Estado: "pendiente", FechaInicio: &inicio, FechaFin: &fin})
	inicio2, fin2 := clock.Today().AddDate(0, 0, 20), clock.Today().AddDate(0, 0, 22)
	tx.Create(&db.Reserva{UsuarioID: u.ID, AlojamientoID: &a.ID, Tipo: "alojamiento", Estado: "confirmada", FechaInicio: &inicio2, FechaFin: &fin2, EsBloqueoAdmin: true})

	rec := httptest.NewRecorder()
	h.listAdmin(rec, reqConParam(http.MethodGet, "/reservas", nil, nil))

	var resp []reservaResponse
	mustUnmarshal(t, rec.Body.Bytes(), &resp)
	if len(resp) != 1 {
		t.Fatalf("esperaba 1 reserva (el bloqueo no cuenta), dio %d", len(resp))
	}
}

func TestListAdmin_FiltraPorEstado(t *testing.T) {
	h, tx := newReservaHandler(t)
	u := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)
	i1, f1 := clock.Today().AddDate(0, 0, 5), clock.Today().AddDate(0, 0, 8)
	tx.Create(&db.Reserva{UsuarioID: u.ID, AlojamientoID: &a.ID, Tipo: "alojamiento", Estado: "pendiente", FechaInicio: &i1, FechaFin: &f1})
	i2, f2 := clock.Today().AddDate(0, 0, 20), clock.Today().AddDate(0, 0, 22)
	tx.Create(&db.Reserva{UsuarioID: u.ID, AlojamientoID: &a.ID, Tipo: "alojamiento", Estado: "confirmada", FechaInicio: &i2, FechaFin: &f2})

	rec := httptest.NewRecorder()
	h.listAdmin(rec, reqConParam(http.MethodGet, "/reservas?estado=pendiente", nil, nil))

	var resp []reservaResponse
	mustUnmarshal(t, rec.Body.Bytes(), &resp)
	if len(resp) != 1 || resp[0].Estado != "pendiente" {
		t.Fatalf("esperaba solo la pendiente, dio %d resultados", len(resp))
	}
}

// --- actualizarEstado ---

func TestActualizarEstado_ConfirmaUnaPendiente(t *testing.T) {
	h, tx := newReservaHandler(t)
	u := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)
	inicio, fin := clock.Today().AddDate(0, 0, 5), clock.Today().AddDate(0, 0, 8)
	reserva := db.Reserva{UsuarioID: u.ID, AlojamientoID: &a.ID, Tipo: "alojamiento", Estado: "pendiente", FechaInicio: &inicio, FechaFin: &fin}
	tx.Create(&reserva)

	body := jsonBody(t, actualizarEstadoRequest{Estado: "confirmada"})
	rec := httptest.NewRecorder()
	h.actualizarEstado(rec, reqConParam(http.MethodPatch, "/reservas/"+reserva.ID.String()+"/estado", body, map[string]string{"id": reserva.ID.String()}))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusOK, rec.Body.String())
	}
}

func TestActualizarEstado_EstadoInvalidoDaBadRequest(t *testing.T) {
	h, tx := newReservaHandler(t)
	a := crearAlojamientoDePrueba(t, tx, nil)
	body := jsonBody(t, actualizarEstadoRequest{Estado: "no-existe"})
	rec := httptest.NewRecorder()
	h.actualizarEstado(rec, reqConParam(http.MethodPatch, "/x", body, map[string]string{"id": a.ID.String()}))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

func TestActualizarEstado_YaCanceladaDaConflict(t *testing.T) {
	h, tx := newReservaHandler(t)
	u := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)
	inicio, fin := clock.Today().AddDate(0, 0, 5), clock.Today().AddDate(0, 0, 8)
	reserva := db.Reserva{UsuarioID: u.ID, AlojamientoID: &a.ID, Tipo: "alojamiento", Estado: "cancelada", FechaInicio: &inicio, FechaFin: &fin}
	tx.Create(&reserva)

	body := jsonBody(t, actualizarEstadoRequest{Estado: "confirmada"})
	rec := httptest.NewRecorder()
	h.actualizarEstado(rec, reqConParam(http.MethodPatch, "/x", body, map[string]string{"id": reserva.ID.String()}))

	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusConflict)
	}
}

func TestActualizarEstado_MismoEstadoDaConflict(t *testing.T) {
	h, tx := newReservaHandler(t)
	u := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)
	inicio, fin := clock.Today().AddDate(0, 0, 5), clock.Today().AddDate(0, 0, 8)
	reserva := db.Reserva{UsuarioID: u.ID, AlojamientoID: &a.ID, Tipo: "alojamiento", Estado: "pendiente", FechaInicio: &inicio, FechaFin: &fin}
	tx.Create(&reserva)

	body := jsonBody(t, actualizarEstadoRequest{Estado: "pendiente"})
	rec := httptest.NewRecorder()
	h.actualizarEstado(rec, reqConParam(http.MethodPatch, "/x", body, map[string]string{"id": reserva.ID.String()}))

	// "pendiente" no es un valor válido de todos modos (solo
	// confirmada/cancelada), así que esto en realidad da BadRequest antes
	// de llegar al chequeo de "mismo estado" — documenta ese orden.
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

func TestActualizarEstado_InexistenteDaNotFound(t *testing.T) {
	h, _ := newReservaHandler(t)
	id := uuid.New().String()
	body := jsonBody(t, actualizarEstadoRequest{Estado: "confirmada"})
	rec := httptest.NewRecorder()
	h.actualizarEstado(rec, reqConParam(http.MethodPatch, "/x", body, map[string]string{"id": id}))

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusNotFound)
	}
}

func TestActualizarEstado_NoAfectaBloqueos(t *testing.T) {
	h, tx := newReservaHandler(t)
	u := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)
	inicio, fin := clock.Today().AddDate(0, 0, 5), clock.Today().AddDate(0, 0, 8)
	bloqueo := db.Reserva{UsuarioID: u.ID, AlojamientoID: &a.ID, Tipo: "alojamiento", Estado: "confirmada", FechaInicio: &inicio, FechaFin: &fin, EsBloqueoAdmin: true}
	tx.Create(&bloqueo)

	body := jsonBody(t, actualizarEstadoRequest{Estado: "cancelada"})
	rec := httptest.NewRecorder()
	h.actualizarEstado(rec, reqConParam(http.MethodPatch, "/x", body, map[string]string{"id": bloqueo.ID.String()}))

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, esperaba %d — actualizarEstado no debería tocar bloqueos", rec.Code, http.StatusNotFound)
	}
}

// --- actualizarDatos ---

func TestActualizarDatos_ActualizaFechasYRecalculaTotal(t *testing.T) {
	h, tx := newReservaHandler(t)
	u := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, func(al *db.Alojamiento) { al.PrecioNoche = 500 })
	inicio, fin := clock.Today().AddDate(0, 0, 5), clock.Today().AddDate(0, 0, 8)
	reserva := db.Reserva{UsuarioID: u.ID, AlojamientoID: &a.ID, Tipo: "alojamiento", Estado: "pendiente", FechaInicio: &inicio, FechaFin: &fin, Total: 1500}
	tx.Create(&reserva)

	nuevas := crearReservaValida()
	nuevas.FechaInicio = clock.Today().AddDate(0, 0, 10).Format(dateLayout)
	nuevas.FechaFin = clock.Today().AddDate(0, 0, 14).Format(dateLayout) // 4 noches
	rec := httptest.NewRecorder()
	h.actualizarDatos(rec, reqConParam(http.MethodPatch, "/x", jsonBody(t, nuevas), map[string]string{"id": reserva.ID.String()}))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	var resp reservaResponse
	mustUnmarshal(t, rec.Body.Bytes(), &resp)
	if resp.Total != 2000 {
		t.Fatalf("Total = %v, esperaba 2000 (4 noches x 500)", resp.Total)
	}
}

func TestActualizarDatos_CanceladaDaConflict(t *testing.T) {
	h, tx := newReservaHandler(t)
	u := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)
	inicio, fin := clock.Today().AddDate(0, 0, 5), clock.Today().AddDate(0, 0, 8)
	reserva := db.Reserva{UsuarioID: u.ID, AlojamientoID: &a.ID, Tipo: "alojamiento", Estado: "cancelada", FechaInicio: &inicio, FechaFin: &fin}
	tx.Create(&reserva)

	rec := httptest.NewRecorder()
	h.actualizarDatos(rec, reqConParam(http.MethodPatch, "/x", jsonBody(t, crearReservaValida()), map[string]string{"id": reserva.ID.String()}))

	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusConflict)
	}
}

func TestActualizarDatos_InexistenteDaNotFound(t *testing.T) {
	h, _ := newReservaHandler(t)
	id := uuid.New().String()
	rec := httptest.NewRecorder()
	h.actualizarDatos(rec, reqConParam(http.MethodPatch, "/x", jsonBody(t, crearReservaValida()), map[string]string{"id": id}))

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusNotFound)
	}
}

func TestActualizarDatos_IdInvalidoDaBadRequest(t *testing.T) {
	h, _ := newReservaHandler(t)
	rec := httptest.NewRecorder()
	h.actualizarDatos(rec, reqConParam(http.MethodPatch, "/x", jsonBody(t, crearReservaValida()), map[string]string{"id": "no-es-un-uuid"}))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

func TestActualizarDatos_CuerpoInvalidoDaBadRequest(t *testing.T) {
	h, tx := newReservaHandler(t)
	u := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)
	inicio, fin := clock.Today().AddDate(0, 0, 5), clock.Today().AddDate(0, 0, 8)
	reserva := db.Reserva{UsuarioID: u.ID, AlojamientoID: &a.ID, Tipo: "alojamiento", Estado: "pendiente", FechaInicio: &inicio, FechaFin: &fin}
	tx.Create(&reserva)

	rec := httptest.NewRecorder()
	h.actualizarDatos(rec, reqConParam(http.MethodPatch, "/x", stringBody("no es json"), map[string]string{"id": reserva.ID.String()}))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

func TestActualizarDatos_CheckoutNoPosteriorDaBadRequest(t *testing.T) {
	h, tx := newReservaHandler(t)
	u := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)
	inicio, fin := clock.Today().AddDate(0, 0, 5), clock.Today().AddDate(0, 0, 8)
	reserva := db.Reserva{UsuarioID: u.ID, AlojamientoID: &a.ID, Tipo: "alojamiento", Estado: "pendiente", FechaInicio: &inicio, FechaFin: &fin}
	tx.Create(&reserva)

	nuevas := crearReservaValida()
	nuevas.FechaInicio = clock.Today().AddDate(0, 0, 10).Format(dateLayout)
	nuevas.FechaFin = clock.Today().AddDate(0, 0, 10).Format(dateLayout)
	rec := httptest.NewRecorder()
	h.actualizarDatos(rec, reqConParam(http.MethodPatch, "/x", jsonBody(t, nuevas), map[string]string{"id": reserva.ID.String()}))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

func TestActualizarDatos_FechasSolapadasConOtraReservaDaConflict(t *testing.T) {
	h, tx := newReservaHandler(t)
	u := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)

	iOcupada, fOcupada := clock.Today().AddDate(0, 0, 20), clock.Today().AddDate(0, 0, 25)
	ocupante := db.Reserva{UsuarioID: u.ID, AlojamientoID: &a.ID, Tipo: "alojamiento", Estado: "confirmada", FechaInicio: &iOcupada, FechaFin: &fOcupada}
	tx.Create(&ocupante)

	iPropia, fPropia := clock.Today().AddDate(0, 0, 5), clock.Today().AddDate(0, 0, 8)
	propia := db.Reserva{UsuarioID: u.ID, AlojamientoID: &a.ID, Tipo: "alojamiento", Estado: "pendiente", FechaInicio: &iPropia, FechaFin: &fPropia}
	tx.Create(&propia)

	nuevas := crearReservaValida()
	nuevas.FechaInicio = clock.Today().AddDate(0, 0, 21).Format(dateLayout)
	nuevas.FechaFin = clock.Today().AddDate(0, 0, 23).Format(dateLayout)
	rec := httptest.NewRecorder()
	h.actualizarDatos(rec, reqConParam(http.MethodPatch, "/x", jsonBody(t, nuevas), map[string]string{"id": propia.ID.String()}))

	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusConflict)
	}
}

// --- isExclusionViolation ---

func TestIsExclusionViolation(t *testing.T) {
	if isExclusionViolation(nil) {
		t.Error("nil no debería ser una violación")
	}
	if isExclusionViolation(errors.New("otro error cualquiera")) {
		t.Error("un error genérico no debería ser una violación")
	}
	if !isExclusionViolation(&pgconn.PgError{Code: exclusionViolationCode}) {
		t.Error("un PgError con el código correcto debería detectarse como violación")
	}
	if isExclusionViolation(&pgconn.PgError{Code: "23505"}) {
		t.Error("un PgError con otro código no debería detectarse como violación de exclusion constraint")
	}
}
