package http

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"gorm.io/gorm"

	"turismo-marcuzzi/api/internal/testdb"
)

func newContenidoHandler(t *testing.T) (*contenidoHandler, *gorm.DB) {
	t.Helper()
	tx := testdb.New(t)
	return &contenidoHandler{db: tx}, tx
}

func TestContenidoGet_SinFilaDevuelveVacio(t *testing.T) {
	h, _ := newContenidoHandler(t)
	rec := httptest.NewRecorder()
	h.get(rec, reqConParam(http.MethodGet, "/x", nil, map[string]string{"clave": "no-existe"}))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, esperaba %d (200 con strings vacíos, no 404)", rec.Code, http.StatusOK)
	}
	var resp contenidoResponse
	mustUnmarshal(t, rec.Body.Bytes(), &resp)
	if resp.Titulo != "" || resp.Descripcion != "" {
		t.Fatalf("esperaba título/descripción vacíos, dio %+v", resp)
	}
}

func TestContenido_ActualizarYLuegoGet(t *testing.T) {
	h, _ := newContenidoHandler(t)

	body := jsonBody(t, actualizarContenidoRequest{Titulo: "Título nuevo", Descripcion: "  Descripción nueva  "})
	rec := httptest.NewRecorder()
	h.actualizar(rec, reqConParam(http.MethodPut, "/x", body, map[string]string{"clave": "alojamiento_listado"}))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	var resp contenidoResponse
	mustUnmarshal(t, rec.Body.Bytes(), &resp)
	if resp.Descripcion != "Descripción nueva" {
		t.Fatalf("Descripcion = %q, esperaba recortada sin espacios", resp.Descripcion)
	}

	// Regresión: Save() con una PK string siempre seteada nunca hacía el
	// INSERT inicial (bug real, TR mencionado en el comentario de
	// actualizar()) — confirmar que un GET posterior encuentra la fila.
	recGet := httptest.NewRecorder()
	h.get(recGet, reqConParam(http.MethodGet, "/x", nil, map[string]string{"clave": "alojamiento_listado"}))
	var respGet contenidoResponse
	mustUnmarshal(t, recGet.Body.Bytes(), &respGet)
	if respGet.Titulo != "Título nuevo" {
		t.Fatalf("el GET posterior a un PUT debería devolver el valor recién guardado, dio %+v", respGet)
	}
}

func TestContenido_ActualizarDosVecesHaceUpsert(t *testing.T) {
	h, _ := newContenidoHandler(t)

	primera := jsonBody(t, actualizarContenidoRequest{Titulo: "Primero", Descripcion: "A"})
	h.actualizar(httptest.NewRecorder(), reqConParam(http.MethodPut, "/x", primera, map[string]string{"clave": "home_hero"}))

	segunda := jsonBody(t, actualizarContenidoRequest{Titulo: "Segundo", Descripcion: "B"})
	rec := httptest.NewRecorder()
	h.actualizar(rec, reqConParam(http.MethodPut, "/x", segunda, map[string]string{"clave": "home_hero"}))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusOK)
	}
	var resp contenidoResponse
	mustUnmarshal(t, rec.Body.Bytes(), &resp)
	if resp.Titulo != "Segundo" {
		t.Fatalf("Titulo = %q, esperaba que la segunda escritura reemplace a la primera (upsert)", resp.Titulo)
	}
}

func TestContenido_CuerpoInvalidoDaBadRequest(t *testing.T) {
	h, _ := newContenidoHandler(t)
	rec := httptest.NewRecorder()
	h.actualizar(rec, reqConParam(http.MethodPut, "/x", stringBody("no es json"), map[string]string{"clave": "x"}))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}
