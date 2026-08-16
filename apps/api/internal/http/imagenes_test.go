package http

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"gorm.io/gorm"

	"turismo-marcuzzi/api/internal/db"
	"turismo-marcuzzi/api/internal/testdb"
)

func newImagenSitioHandler(t *testing.T) (*imagenSitioHandler, *gorm.DB) {
	t.Helper()
	tx := testdb.New(t)
	return &imagenSitioHandler{db: tx, storage: testStorage(t)}, tx
}

func TestImagenSitioList_Vacio(t *testing.T) {
	h, _ := newImagenSitioHandler(t)
	rec := httptest.NewRecorder()
	h.list(rec, reqConParam(http.MethodGet, "/imagenes-sitio", nil, nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusOK)
	}
	var resp []imagenSitioResponse
	mustUnmarshal(t, rec.Body.Bytes(), &resp)
	if len(resp) != 0 {
		t.Fatalf("esperaba lista vacía sin overrides cargados, dio %d", len(resp))
	}
}

func TestImagenSitio_ActualizarYListar(t *testing.T) {
	h, _ := newImagenSitioHandler(t)

	req := multipartRequest(t, "imagen", "hero.png", pngSignature, map[string]string{"clave": "home_hero"})
	rec := httptest.NewRecorder()
	h.actualizar(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	recList := httptest.NewRecorder()
	h.list(recList, reqConParam(http.MethodGet, "/imagenes-sitio", nil, nil))
	var resp []imagenSitioResponse
	mustUnmarshal(t, recList.Body.Bytes(), &resp)
	if len(resp) != 1 || resp[0].Clave != "home_hero" {
		t.Fatalf("esperaba 1 imagen con clave home_hero, dio %+v", resp)
	}
}

func TestImagenSitio_ActualizarDosVecesHaceUpsert(t *testing.T) {
	h, _ := newImagenSitioHandler(t)

	primera := multipartRequest(t, "imagen", "1.png", pngSignature, map[string]string{"clave": "home_hero"})
	h.actualizar(httptest.NewRecorder(), primera)

	segunda := multipartRequest(t, "imagen", "2.png", pngSignature, map[string]string{"clave": "home_hero"})
	h.actualizar(httptest.NewRecorder(), segunda)

	recList := httptest.NewRecorder()
	h.list(recList, reqConParam(http.MethodGet, "/imagenes-sitio", nil, nil))
	var resp []imagenSitioResponse
	mustUnmarshal(t, recList.Body.Bytes(), &resp)
	if len(resp) != 1 {
		t.Fatalf("esperaba 1 sola fila para la misma clave (upsert, no duplicado), dio %d", len(resp))
	}
}

func TestImagenSitio_RechazaVideo(t *testing.T) {
	h, _ := newImagenSitioHandler(t)
	req := multipartRequest(t, "imagen", "video.webm", webmSignature, map[string]string{"clave": "home_hero"})
	rec := httptest.NewRecorder()
	h.actualizar(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d — imagenes-sitio nunca acepta video", rec.Code, http.StatusBadRequest)
	}
}

func TestImagenSitio_FaltaElArchivoDaBadRequest(t *testing.T) {
	h, _ := newImagenSitioHandler(t)
	req := multipartRequest(t, "otro-campo", "x.png", pngSignature, map[string]string{"clave": "home_hero"})
	rec := httptest.NewRecorder()
	h.actualizar(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

func TestImagenSitio_Eliminar(t *testing.T) {
	h, tx := newImagenSitioHandler(t)
	req := multipartRequest(t, "imagen", "1.png", pngSignature, map[string]string{"clave": "home_hero"})
	h.actualizar(httptest.NewRecorder(), req)

	rec := httptest.NewRecorder()
	h.eliminar(rec, reqConParam(http.MethodDelete, "/x", nil, map[string]string{"clave": "home_hero"}))

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusNoContent)
	}
	var count int64
	tx.Model(&db.ImagenSitio{}).Where("clave = ?", "home_hero").Count(&count)
	if count != 0 {
		t.Fatal("la fila debería haberse borrado")
	}
}

func TestImagenSitio_EliminarInexistenteDaNotFound(t *testing.T) {
	h, _ := newImagenSitioHandler(t)
	rec := httptest.NewRecorder()
	h.eliminar(rec, reqConParam(http.MethodDelete, "/x", nil, map[string]string{"clave": "no-existe"}))

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusNotFound)
	}
}
