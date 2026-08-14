package http

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"turismo-marcuzzi/api/internal/clock"
	"turismo-marcuzzi/api/internal/db"
	"turismo-marcuzzi/api/internal/testdb"
)

func newResenaHandler(t *testing.T) (*resenaHandler, *gorm.DB) {
	t.Helper()
	tx := testdb.New(t)
	return &resenaHandler{db: tx}, tx
}

func confirmarReservaDePrueba(t *testing.T, tx *gorm.DB, usuarioID, alojamientoID uuid.UUID) {
	t.Helper()
	inicio, fin := clock.Today().AddDate(0, 0, -5), clock.Today().AddDate(0, 0, -1)
	reserva := db.Reserva{
		UsuarioID: usuarioID, AlojamientoID: &alojamientoID, Tipo: "alojamiento",
		Estado: "confirmada", FechaInicio: &inicio, FechaFin: &fin,
	}
	if err := tx.Create(&reserva).Error; err != nil {
		t.Fatalf("no se pudo crear la reserva confirmada de prueba: %v", err)
	}
}

// --- list (público) ---

func TestResenaList_SoloDevuelveNoOcultas(t *testing.T) {
	h, tx := newResenaHandler(t)
	u := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)
	tx.Create(&db.Resena{UsuarioID: u.ID, AlojamientoID: &a.ID, Rating: 5, Texto: "Visible", Oculta: false})
	tx.Create(&db.Resena{UsuarioID: u.ID, AlojamientoID: &a.ID, Rating: 1, Texto: "Oculta", Oculta: true})

	rec := httptest.NewRecorder()
	h.list(rec, reqConParam(http.MethodGet, "/x", nil, map[string]string{"id": a.ID.String()}))

	var resp []resenaResponse
	mustUnmarshal(t, rec.Body.Bytes(), &resp)
	if len(resp) != 1 || resp[0].Texto != "Visible" {
		t.Fatalf("esperaba solo la reseña visible, dio %d resultados", len(resp))
	}
}

func TestResenaList_IdInvalidoDaBadRequest(t *testing.T) {
	h, _ := newResenaHandler(t)
	rec := httptest.NewRecorder()
	h.list(rec, reqConParam(http.MethodGet, "/x", nil, map[string]string{"id": "no-es-un-uuid"}))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

// --- listAdmin ---

func TestResenaListAdmin_IncluyeOcultas(t *testing.T) {
	h, tx := newResenaHandler(t)
	u := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)
	tx.Create(&db.Resena{UsuarioID: u.ID, AlojamientoID: &a.ID, Rating: 5, Texto: "Visible", Oculta: false})
	tx.Create(&db.Resena{UsuarioID: u.ID, AlojamientoID: &a.ID, Rating: 1, Texto: "Oculta", Oculta: true})

	rec := httptest.NewRecorder()
	h.listAdmin(rec, reqConParam(http.MethodGet, "/resenas", nil, nil))

	var resp []resenaResponse
	mustUnmarshal(t, rec.Body.Bytes(), &resp)
	if len(resp) != 2 {
		t.Fatalf("esperaba las 2 reseñas (incluida la oculta), dio %d", len(resp))
	}
}

// --- moderar ---

func TestModerar_OcultaUnaResena(t *testing.T) {
	h, tx := newResenaHandler(t)
	u := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)
	resena := db.Resena{UsuarioID: u.ID, AlojamientoID: &a.ID, Rating: 5, Texto: "Texto", Oculta: false}
	tx.Create(&resena)

	body := jsonBody(t, moderarResenaRequest{Oculta: true})
	rec := httptest.NewRecorder()
	h.moderar(rec, reqConParam(http.MethodPatch, "/x", body, map[string]string{"id": resena.ID.String()}))

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusNoContent)
	}
	var recargada db.Resena
	tx.First(&recargada, "id = ?", resena.ID)
	if !recargada.Oculta {
		t.Fatal("la reseña debería quedar oculta=true")
	}
}

func TestModerar_InexistenteDaNotFound(t *testing.T) {
	h, _ := newResenaHandler(t)
	id := uuid.New().String()
	body := jsonBody(t, moderarResenaRequest{Oculta: true})
	rec := httptest.NewRecorder()
	h.moderar(rec, reqConParam(http.MethodPatch, "/x", body, map[string]string{"id": id}))

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusNotFound)
	}
}

func TestModerar_IdInvalidoDaBadRequest(t *testing.T) {
	h, _ := newResenaHandler(t)
	body := jsonBody(t, moderarResenaRequest{Oculta: true})
	rec := httptest.NewRecorder()
	h.moderar(rec, reqConParam(http.MethodPatch, "/x", body, map[string]string{"id": "no-es-un-uuid"}))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

func TestModerar_CuerpoInvalidoDaBadRequest(t *testing.T) {
	h, tx := newResenaHandler(t)
	u := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)
	resena := db.Resena{UsuarioID: u.ID, AlojamientoID: &a.ID, Rating: 5, Texto: "Texto"}
	tx.Create(&resena)

	rec := httptest.NewRecorder()
	h.moderar(rec, reqConParam(http.MethodPatch, "/x", stringBody("no es json"), map[string]string{"id": resena.ID.String()}))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

// --- create ---

func TestResenaCreate_ConReservaConfirmada(t *testing.T) {
	h, tx := newResenaHandler(t)
	u := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)
	confirmarReservaDePrueba(t, tx, u.ID, a.ID)

	body := jsonBody(t, crearResenaRequest{Rating: 5, Texto: "Excelente lugar"})
	req := reqConClaims(http.MethodPost, "/x", body, map[string]string{"id": a.ID.String()}, claimsDe(u.ID, "cliente"))
	rec := httptest.NewRecorder()
	h.create(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusCreated, rec.Body.String())
	}
}

func TestResenaCreate_SinReservaConfirmadaDaForbidden(t *testing.T) {
	h, tx := newResenaHandler(t)
	u := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)

	body := jsonBody(t, crearResenaRequest{Rating: 5, Texto: "Texto"})
	req := reqConClaims(http.MethodPost, "/x", body, map[string]string{"id": a.ID.String()}, claimsDe(u.ID, "cliente"))
	rec := httptest.NewRecorder()
	h.create(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusForbidden)
	}
}

func TestResenaCreate_ConReservaSoloPendienteDaForbidden(t *testing.T) {
	h, tx := newResenaHandler(t)
	u := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)
	inicio, fin := clock.Today().AddDate(0, 0, 5), clock.Today().AddDate(0, 0, 8)
	tx.Create(&db.Reserva{UsuarioID: u.ID, AlojamientoID: &a.ID, Tipo: "alojamiento", Estado: "pendiente", FechaInicio: &inicio, FechaFin: &fin})

	body := jsonBody(t, crearResenaRequest{Rating: 5, Texto: "Texto"})
	req := reqConClaims(http.MethodPost, "/x", body, map[string]string{"id": a.ID.String()}, claimsDe(u.ID, "cliente"))
	rec := httptest.NewRecorder()
	h.create(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, esperaba %d — una reserva pendiente no alcanza", rec.Code, http.StatusForbidden)
	}
}

func TestResenaCreate_DuplicadaDaConflict(t *testing.T) {
	h, tx := newResenaHandler(t)
	u := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)
	confirmarReservaDePrueba(t, tx, u.ID, a.ID)
	tx.Create(&db.Resena{UsuarioID: u.ID, AlojamientoID: &a.ID, Rating: 4, Texto: "Ya reseñé"})

	body := jsonBody(t, crearResenaRequest{Rating: 5, Texto: "Otra vez"})
	req := reqConClaims(http.MethodPost, "/x", body, map[string]string{"id": a.ID.String()}, claimsDe(u.ID, "cliente"))
	rec := httptest.NewRecorder()
	h.create(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusConflict)
	}
}

func TestResenaCreate_AdminNoPuedeResenar(t *testing.T) {
	h, tx := newResenaHandler(t)
	u := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)

	body := jsonBody(t, crearResenaRequest{Rating: 5, Texto: "Texto"})
	req := reqConClaims(http.MethodPost, "/x", body, map[string]string{"id": a.ID.String()}, claimsDe(u.ID, "administrador"))
	rec := httptest.NewRecorder()
	h.create(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusForbidden)
	}
}

func TestResenaCreate_SinClaimsDaUnauthorized(t *testing.T) {
	h, tx := newResenaHandler(t)
	a := crearAlojamientoDePrueba(t, tx, nil)
	body := jsonBody(t, crearResenaRequest{Rating: 5, Texto: "Texto"})
	req := reqConClaims(http.MethodPost, "/x", body, map[string]string{"id": a.ID.String()}, nil)
	rec := httptest.NewRecorder()
	h.create(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestResenaCreate_RatingFueraDeRangoDaBadRequest(t *testing.T) {
	h, tx := newResenaHandler(t)
	u := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)

	casos := []int{0, 6, -1}
	for _, rating := range casos {
		body := jsonBody(t, crearResenaRequest{Rating: rating, Texto: "Texto"})
		req := reqConClaims(http.MethodPost, "/x", body, map[string]string{"id": a.ID.String()}, claimsDe(u.ID, "cliente"))
		rec := httptest.NewRecorder()
		h.create(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Fatalf("rating=%d: status = %d, esperaba %d", rating, rec.Code, http.StatusBadRequest)
		}
	}
}

func TestResenaCreate_TextoVacioDaBadRequest(t *testing.T) {
	h, tx := newResenaHandler(t)
	u := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)

	body := jsonBody(t, crearResenaRequest{Rating: 5, Texto: "   "})
	req := reqConClaims(http.MethodPost, "/x", body, map[string]string{"id": a.ID.String()}, claimsDe(u.ID, "cliente"))
	rec := httptest.NewRecorder()
	h.create(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

func TestResenaCreate_IdInvalidoDaBadRequest(t *testing.T) {
	h, tx := newResenaHandler(t)
	u := crearUsuarioDePrueba(t, tx)
	body := jsonBody(t, crearResenaRequest{Rating: 5, Texto: "Texto"})
	req := reqConClaims(http.MethodPost, "/x", body, map[string]string{"id": "no-es-un-uuid"}, claimsDe(u.ID, "cliente"))
	rec := httptest.NewRecorder()
	h.create(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

func TestResenaCreate_CuerpoInvalidoDaBadRequest(t *testing.T) {
	h, tx := newResenaHandler(t)
	u := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)
	req := reqConClaims(http.MethodPost, "/x", stringBody("no es json"), map[string]string{"id": a.ID.String()}, claimsDe(u.ID, "cliente"))
	rec := httptest.NewRecorder()
	h.create(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}
