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

func newBloqueoHandler(t *testing.T) (*bloqueoHandler, *gorm.DB) {
	t.Helper()
	tx := testdb.New(t)
	return &bloqueoHandler{db: tx}, tx
}

func bloqueoValido() crearBloqueoRequest {
	return crearBloqueoRequest{
		FechaInicio: clock.Today().AddDate(0, 0, 5).Format(dateLayout),
		FechaFin:    clock.Today().AddDate(0, 0, 8).Format(dateLayout),
		Motivo:      "Mantenimiento",
	}
}

// --- list ---

func TestBloqueoList_DevuelveVigentes(t *testing.T) {
	h, tx := newBloqueoHandler(t)
	admin := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)
	inicio, fin := clock.Today().AddDate(0, 0, 5), clock.Today().AddDate(0, 0, 8)
	tx.Create(&db.Reserva{
		UsuarioID: admin.ID, AlojamientoID: &a.ID, Tipo: "alojamiento", Estado: "confirmada",
		FechaInicio: &inicio, FechaFin: &fin, EsBloqueoAdmin: true, BloqueoMotivo: "Test",
	})

	rec := httptest.NewRecorder()
	h.list(rec, reqConParam(http.MethodGet, "/x", nil, map[string]string{"id": a.ID.String()}))

	var resp []bloqueoResponse
	mustUnmarshal(t, rec.Body.Bytes(), &resp)
	if len(resp) != 1 {
		t.Fatalf("esperaba 1 bloqueo vigente, dio %d", len(resp))
	}
}

func TestBloqueoList_NoDevuelveVencidos(t *testing.T) {
	h, tx := newBloqueoHandler(t)
	admin := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)
	inicio, fin := clock.Today().AddDate(0, 0, -10), clock.Today().AddDate(0, 0, -5)
	tx.Create(&db.Reserva{
		UsuarioID: admin.ID, AlojamientoID: &a.ID, Tipo: "alojamiento", Estado: "confirmada",
		FechaInicio: &inicio, FechaFin: &fin, EsBloqueoAdmin: true,
	})

	rec := httptest.NewRecorder()
	h.list(rec, reqConParam(http.MethodGet, "/x", nil, map[string]string{"id": a.ID.String()}))

	var resp []bloqueoResponse
	mustUnmarshal(t, rec.Body.Bytes(), &resp)
	if len(resp) != 0 {
		t.Fatalf("un bloqueo ya vencido no debería listarse, dio %d", len(resp))
	}
}

func TestBloqueoList_NoDevuelveCancelados(t *testing.T) {
	h, tx := newBloqueoHandler(t)
	admin := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)
	inicio, fin := clock.Today().AddDate(0, 0, 5), clock.Today().AddDate(0, 0, 8)
	tx.Create(&db.Reserva{
		UsuarioID: admin.ID, AlojamientoID: &a.ID, Tipo: "alojamiento", Estado: "cancelada",
		FechaInicio: &inicio, FechaFin: &fin, EsBloqueoAdmin: true,
	})

	rec := httptest.NewRecorder()
	h.list(rec, reqConParam(http.MethodGet, "/x", nil, map[string]string{"id": a.ID.String()}))

	var resp []bloqueoResponse
	mustUnmarshal(t, rec.Body.Bytes(), &resp)
	if len(resp) != 0 {
		t.Fatalf("un bloqueo liberado (cancelado) no debería listarse, dio %d", len(resp))
	}
}

func TestBloqueoList_IdInvalidoDaBadRequest(t *testing.T) {
	h, _ := newBloqueoHandler(t)
	rec := httptest.NewRecorder()
	h.list(rec, reqConParam(http.MethodGet, "/x", nil, map[string]string{"id": "no-es-un-uuid"}))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

// --- create ---

func TestBloqueoCreate_Exitoso(t *testing.T) {
	h, tx := newBloqueoHandler(t)
	admin := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)

	req := reqConClaims(http.MethodPost, "/x", jsonBody(t, bloqueoValido()), map[string]string{"id": a.ID.String()}, claimsDe(admin.ID, "administrador"))
	rec := httptest.NewRecorder()
	h.create(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusCreated, rec.Body.String())
	}
}

func TestBloqueoCreate_SinClaimsDaUnauthorized(t *testing.T) {
	h, tx := newBloqueoHandler(t)
	a := crearAlojamientoDePrueba(t, tx, nil)
	req := reqConClaims(http.MethodPost, "/x", jsonBody(t, bloqueoValido()), map[string]string{"id": a.ID.String()}, nil)
	rec := httptest.NewRecorder()
	h.create(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestBloqueoCreate_AlojamientoInexistenteDaNotFound(t *testing.T) {
	h, tx := newBloqueoHandler(t)
	admin := crearUsuarioDePrueba(t, tx)
	id := uuid.New().String()
	req := reqConClaims(http.MethodPost, "/x", jsonBody(t, bloqueoValido()), map[string]string{"id": id}, claimsDe(admin.ID, "administrador"))
	rec := httptest.NewRecorder()
	h.create(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusNotFound)
	}
}

func TestBloqueoCreate_FechasInvalidasDanBadRequest(t *testing.T) {
	h, tx := newBloqueoHandler(t)
	admin := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)

	bloqueo := bloqueoValido()
	bloqueo.FechaFin = bloqueo.FechaInicio // no es posterior
	req := reqConClaims(http.MethodPost, "/x", jsonBody(t, bloqueo), map[string]string{"id": a.ID.String()}, claimsDe(admin.ID, "administrador"))
	rec := httptest.NewRecorder()
	h.create(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

func TestBloqueoCreate_SinAnticipacionEsValido(t *testing.T) {
	// A diferencia de crear reserva, un bloqueo puede empezar hoy mismo
	// (el admin puede necesitar bloquear por mantenimiento urgente).
	h, tx := newBloqueoHandler(t)
	admin := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)

	bloqueo := bloqueoValido()
	bloqueo.FechaInicio = clock.Today().Format(dateLayout)
	bloqueo.FechaFin = clock.Today().AddDate(0, 0, 1).Format(dateLayout)
	req := reqConClaims(http.MethodPost, "/x", jsonBody(t, bloqueo), map[string]string{"id": a.ID.String()}, claimsDe(admin.ID, "administrador"))
	rec := httptest.NewRecorder()
	h.create(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusCreated, rec.Body.String())
	}
}

func TestBloqueoCreate_SolapadoConOtroDaConflict(t *testing.T) {
	h, tx := newBloqueoHandler(t)
	admin := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)

	primero := reqConClaims(http.MethodPost, "/x", jsonBody(t, bloqueoValido()), map[string]string{"id": a.ID.String()}, claimsDe(admin.ID, "administrador"))
	h.create(httptest.NewRecorder(), primero)

	segundo := reqConClaims(http.MethodPost, "/x", jsonBody(t, bloqueoValido()), map[string]string{"id": a.ID.String()}, claimsDe(admin.ID, "administrador"))
	rec := httptest.NewRecorder()
	h.create(rec, segundo)

	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusConflict)
	}
}

func TestBloqueoCreate_CuerpoInvalidoDaBadRequest(t *testing.T) {
	h, tx := newBloqueoHandler(t)
	admin := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)
	req := reqConClaims(http.MethodPost, "/x", stringBody("no es json"), map[string]string{"id": a.ID.String()}, claimsDe(admin.ID, "administrador"))
	rec := httptest.NewRecorder()
	h.create(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

func TestBloqueoCreate_IdInvalidoDaBadRequest(t *testing.T) {
	h, tx := newBloqueoHandler(t)
	admin := crearUsuarioDePrueba(t, tx)
	req := reqConClaims(http.MethodPost, "/x", jsonBody(t, bloqueoValido()), map[string]string{"id": "no-es-un-uuid"}, claimsDe(admin.ID, "administrador"))
	rec := httptest.NewRecorder()
	h.create(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

// --- delete ---

func TestBloqueoDelete_LiberaElBloqueo(t *testing.T) {
	h, tx := newBloqueoHandler(t)
	admin := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)
	inicio, fin := clock.Today().AddDate(0, 0, 5), clock.Today().AddDate(0, 0, 8)
	bloqueo := db.Reserva{
		UsuarioID: admin.ID, AlojamientoID: &a.ID, Tipo: "alojamiento", Estado: "confirmada",
		FechaInicio: &inicio, FechaFin: &fin, EsBloqueoAdmin: true,
	}
	tx.Create(&bloqueo)

	rec := httptest.NewRecorder()
	h.delete(rec, reqConParam(http.MethodDelete, "/x", nil, map[string]string{"id": a.ID.String(), "bloqueoId": bloqueo.ID.String()}))

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusNoContent)
	}
	var recargado db.Reserva
	tx.First(&recargado, "id = ?", bloqueo.ID)
	if recargado.Estado != "cancelada" {
		t.Fatalf("el bloqueo debería quedar cancelado, quedó en %q", recargado.Estado)
	}
}

func TestBloqueoDelete_InexistenteDaNotFound(t *testing.T) {
	h, tx := newBloqueoHandler(t)
	a := crearAlojamientoDePrueba(t, tx, nil)
	id := uuid.New().String()

	rec := httptest.NewRecorder()
	h.delete(rec, reqConParam(http.MethodDelete, "/x", nil, map[string]string{"id": a.ID.String(), "bloqueoId": id}))

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusNotFound)
	}
}

// delete no debe poder liberar una reserva real de cliente disfrazándola
// de bloqueo — el Where exige es_bloqueo_admin = true.
func TestBloqueoDelete_NoAfectaReservaReal(t *testing.T) {
	h, tx := newBloqueoHandler(t)
	u := crearUsuarioDePrueba(t, tx)
	a := crearAlojamientoDePrueba(t, tx, nil)
	inicio, fin := clock.Today().AddDate(0, 0, 5), clock.Today().AddDate(0, 0, 8)
	reserva := db.Reserva{UsuarioID: u.ID, AlojamientoID: &a.ID, Tipo: "alojamiento", Estado: "confirmada", FechaInicio: &inicio, FechaFin: &fin}
	tx.Create(&reserva)

	rec := httptest.NewRecorder()
	h.delete(rec, reqConParam(http.MethodDelete, "/x", nil, map[string]string{"id": a.ID.String(), "bloqueoId": reserva.ID.String()}))

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, esperaba %d — no debería poder cancelar una reserva real como si fuera un bloqueo", rec.Code, http.StatusNotFound)
	}
	var recargada db.Reserva
	tx.First(&recargada, "id = ?", reserva.ID)
	if recargada.Estado != "confirmada" {
		t.Fatal("la reserva real no debería haberse tocado")
	}
}

func TestBloqueoDelete_IdsInvalidosDanBadRequest(t *testing.T) {
	h, tx := newBloqueoHandler(t)
	a := crearAlojamientoDePrueba(t, tx, nil)

	rec := httptest.NewRecorder()
	h.delete(rec, reqConParam(http.MethodDelete, "/x", nil, map[string]string{"id": "no-es-un-uuid", "bloqueoId": uuid.NewString()}))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("id de alojamiento inválido: status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}

	rec2 := httptest.NewRecorder()
	h.delete(rec2, reqConParam(http.MethodDelete, "/x", nil, map[string]string{"id": a.ID.String(), "bloqueoId": "no-es-un-uuid"}))
	if rec2.Code != http.StatusBadRequest {
		t.Fatalf("id de bloqueo inválido: status = %d, esperaba %d", rec2.Code, http.StatusBadRequest)
	}
}
