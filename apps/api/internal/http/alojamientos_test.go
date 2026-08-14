package http

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"turismo-marcuzzi/api/internal/clock"
	"turismo-marcuzzi/api/internal/db"
	"turismo-marcuzzi/api/internal/storage"
	"turismo-marcuzzi/api/internal/testdb"
)

// Firmas mínimas que http.DetectContentType reconoce por sniffing —
// alcanza con los bytes de cabecera, no hace falta un archivo real.
var (
	pngSignature  = []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x00}
	webmSignature = []byte{0x1A, 0x45, 0xDF, 0xA3, 0x00, 0x00, 0x00, 0x00}
)

func multipartRequest(t *testing.T, fieldName, filename string, content []byte, params map[string]string) *http.Request {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	part, err := w.CreateFormFile(fieldName, filename)
	if err != nil {
		t.Fatalf("no se pudo crear la parte multipart: %v", err)
	}
	if _, err := part.Write(content); err != nil {
		t.Fatalf("no se pudo escribir el contenido de prueba: %v", err)
	}
	if err := w.Close(); err != nil {
		t.Fatalf("no se pudo cerrar el multipart writer: %v", err)
	}

	req := reqConParam(http.MethodPost, "/x", &buf, params)
	req.Header.Set("Content-Type", w.FormDataContentType())
	return req
}

func stringBody(s string) *bytes.Buffer {
	return bytes.NewBufferString(s)
}

func mustUnmarshal(t *testing.T, data []byte, v any) {
	t.Helper()
	if err := json.Unmarshal(data, v); err != nil {
		t.Fatalf("no se pudo parsear la respuesta como JSON: %v — body: %s", err, data)
	}
}

// reqConParam simula lo que chi hace en producción: mete los path params
// (p. ej. {id}) en el RouteContext de la request — los handlers los leen
// con chi.URLParam(r, "id"), que sin esto siempre devuelve "".
func reqConParam(method, target string, body io.Reader, params map[string]string) *http.Request {
	req := httptest.NewRequest(method, target, body)
	rctx := chi.NewRouteContext()
	for k, v := range params {
		rctx.URLParams.Add(k, v)
	}
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}

func alojamientoValido() alojamientoRequest {
	return alojamientoRequest{
		Nombre:      "Depto de prueba",
		Descripcion: "Descripción de prueba",
		Lat:         -42.7667,
		Lng:         -65.0333,
		Direccion:   "Calle Falsa 123",
		PrecioNoche: 50000,
		Capacidad:   4,
	}
}

func testStorage(t *testing.T) storage.Storage {
	t.Helper()
	s, err := storage.NewLocalStorage(t.TempDir(), "http://localhost:8080/uploads")
	if err != nil {
		t.Fatalf("no se pudo crear el storage de prueba: %v", err)
	}
	return s
}

func newAlojamientoHandler(t *testing.T) (*alojamientoHandler, *gorm.DB) {
	t.Helper()
	tx := testdb.New(t)
	return &alojamientoHandler{db: tx, storage: testStorage(t), jwtSecret: testSecret}, tx
}

func crearAlojamientoDePrueba(t *testing.T, tx *gorm.DB, mut func(*db.Alojamiento)) db.Alojamiento {
	t.Helper()
	a := db.Alojamiento{
		Nombre:      "Depto de prueba",
		Descripcion: "Descripción",
		Lat:         -42.7667,
		Lng:         -65.0333,
		Direccion:   "Calle Falsa 123",
		PrecioNoche: 50000,
		Capacidad:   4,
		Activo:      true,
	}
	quiereInactivo := false
	if mut != nil {
		mut(&a)
		quiereInactivo = !a.Activo
	}
	if err := tx.Create(&a).Error; err != nil {
		t.Fatalf("no se pudo crear el alojamiento de prueba: %v", err)
	}
	// Mismo motivo que el fix de TR-035 en create(): GORM ignora un
	// Activo=false explícito en Create() porque la columna tiene
	// gorm:"default:true" (probado también con Select("*"), que tampoco
	// lo evita) — sin este Update() de seguimiento, un fixture de test
	// "inactivo" queda insertado como activo=true sin que nada avise.
	if quiereInactivo {
		if err := tx.Model(&a).Update("activo", false).Error; err != nil {
			t.Fatalf("no se pudo forzar activo=false en el alojamiento de prueba: %v", err)
		}
		a.Activo = false
	}
	return a
}

func crearUsuarioDePrueba(t *testing.T, tx *gorm.DB) db.Usuario {
	t.Helper()
	u := db.Usuario{
		Nombre:       "Usuario de prueba",
		Email:        uuid.NewString() + "@example.com",
		PasswordHash: "x",
		Rol:          "cliente",
	}
	if err := tx.Create(&u).Error; err != nil {
		t.Fatalf("no se pudo crear el usuario de prueba: %v", err)
	}
	return u
}

// --- validate() ---

func TestAlojamientoRequest_Validate(t *testing.T) {
	casos := []struct {
		nombre      string
		mut         func(*alojamientoRequest)
		quiereError bool
	}{
		{"válido", func(r *alojamientoRequest) {}, false},
		{"nombre vacío", func(r *alojamientoRequest) { r.Nombre = "   " }, true},
		{"capacidad cero", func(r *alojamientoRequest) { r.Capacidad = 0 }, true},
		{"capacidad negativa", func(r *alojamientoRequest) { r.Capacidad = -1 }, true},
		{"precio cero", func(r *alojamientoRequest) { r.PrecioNoche = 0 }, true},
		{"precio negativo", func(r *alojamientoRequest) { r.PrecioNoche = -100 }, true},
		{"lat fuera de rango (alto)", func(r *alojamientoRequest) { r.Lat = 91 }, true},
		{"lat fuera de rango (bajo)", func(r *alojamientoRequest) { r.Lat = -91 }, true},
		{"lng fuera de rango (alto)", func(r *alojamientoRequest) { r.Lng = 181 }, true},
		{"lng fuera de rango (bajo)", func(r *alojamientoRequest) { r.Lng = -181 }, true},
	}

	for _, c := range casos {
		t.Run(c.nombre, func(t *testing.T) {
			req := alojamientoValido()
			c.mut(&req)
			msg := req.validate()
			if c.quiereError && msg == "" {
				t.Fatal("esperaba un mensaje de error de validate()")
			}
			if !c.quiereError && msg != "" {
				t.Fatalf("no esperaba error, validate() devolvió: %q", msg)
			}
		})
	}
}

// --- create ---

func TestCreate_AlojamientoActivoPorDefecto(t *testing.T) {
	h, _ := newAlojamientoHandler(t)

	req := alojamientoValido()
	rec := httptest.NewRecorder()
	h.create(rec, reqConParam(http.MethodPost, "/alojamientos", jsonBody(t, req), nil))

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusCreated, rec.Body.String())
	}
	var resp alojamientoResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("no se pudo parsear la respuesta: %v", err)
	}
	if !resp.Activo {
		t.Error("un alojamiento creado sin borrador:true debería quedar activo")
	}
}

// Regresión (TR-035): GORM ignora un `false` explícito en Create() cuando
// la columna tiene `gorm:"default:true"` — sin el fix (Update() de
// seguimiento), esto pasaría con activo=true en vez de false.
func TestCreate_BorradorQuedaInactivo(t *testing.T) {
	h, _ := newAlojamientoHandler(t)

	req := alojamientoValido()
	req.Borrador = true
	rec := httptest.NewRecorder()
	h.create(rec, reqConParam(http.MethodPost, "/alojamientos", jsonBody(t, req), nil))

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusCreated, rec.Body.String())
	}
	var resp alojamientoResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("no se pudo parsear la respuesta: %v", err)
	}
	if resp.Activo {
		t.Fatal("un alojamiento creado con borrador:true debería quedar activo=false (regresión TR-035)")
	}
}

func TestCreate_CuerpoInvalidoDaBadRequest(t *testing.T) {
	h, _ := newAlojamientoHandler(t)
	rec := httptest.NewRecorder()
	h.create(rec, reqConParam(http.MethodPost, "/alojamientos", stringBody("no es json"), nil))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

func TestCreate_DatosInvalidosDaBadRequest(t *testing.T) {
	h, _ := newAlojamientoHandler(t)
	req := alojamientoValido()
	req.Nombre = ""
	rec := httptest.NewRecorder()
	h.create(rec, reqConParam(http.MethodPost, "/alojamientos", jsonBody(t, req), nil))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

// --- get ---

func TestGet_AlojamientoExistente(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	a := crearAlojamientoDePrueba(t, tx, nil)

	rec := httptest.NewRecorder()
	h.get(rec, reqConParam(http.MethodGet, "/alojamientos/"+a.ID.String(), nil, map[string]string{"id": a.ID.String()}))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusOK, rec.Body.String())
	}
}

func TestGet_IdInvalidoDaBadRequest(t *testing.T) {
	h, _ := newAlojamientoHandler(t)
	rec := httptest.NewRecorder()
	h.get(rec, reqConParam(http.MethodGet, "/alojamientos/no-es-un-uuid", nil, map[string]string{"id": "no-es-un-uuid"}))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

func TestGet_AlojamientoInexistenteDaNotFound(t *testing.T) {
	h, _ := newAlojamientoHandler(t)
	rec := httptest.NewRecorder()
	id := uuid.New().String()
	h.get(rec, reqConParam(http.MethodGet, "/alojamientos/"+id, nil, map[string]string{"id": id}))

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusNotFound)
	}
}

// GET por id directo NO filtra por activo — un admin (o el propio dueño
// de un borrador recién creado, T4.19) tiene que poder previsualizarlo
// antes de publicarlo.
func TestGet_AlojamientoInactivoSigueVisibleParaPrevisualizar(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	a := crearAlojamientoDePrueba(t, tx, func(al *db.Alojamiento) { al.Activo = false })

	rec := httptest.NewRecorder()
	h.get(rec, reqConParam(http.MethodGet, "/alojamientos/"+a.ID.String(), nil, map[string]string{"id": a.ID.String()}))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusOK)
	}
}

// --- list ---

func contieneID(resp []alojamientoResponse, id string) bool {
	for _, a := range resp {
		if a.ID == id {
			return true
		}
	}
	return false
}

// No asume que la tabla está vacía ni compara longitudes exactas — otros
// paquetes de test (T12.10/T12.12) usan testdb.Shared para sus tests de
// concurrencia real, con filas COMPROMETIDAS de verdad (no en una
// transacción que se revierte) durante una ventana corta mientras
// `go test ./...` corre los paquetes en paralelo. Postgres en READ
// COMMITTED (default) re-snapshotea por statement, no por transacción, así
// que esta query SIN filtro de scope puede ver esas filas ajenas — el test
// tiene que sobrevivir a eso, solo le importan sus propios fixtures.
func TestList_SoloDevuelveActivosParaCallerAnonimo(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	activo := crearAlojamientoDePrueba(t, tx, func(a *db.Alojamiento) { a.Nombre = "Activo" })
	inactivo := crearAlojamientoDePrueba(t, tx, func(a *db.Alojamiento) { a.Nombre = "Inactivo"; a.Activo = false })

	rec := httptest.NewRecorder()
	h.list(rec, reqConParam(http.MethodGet, "/alojamientos", nil, nil))

	var resp []alojamientoResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("no se pudo parsear la respuesta: %v", err)
	}
	if !contieneID(resp, activo.ID.String()) {
		t.Fatal("el alojamiento activo debería aparecer en el listado")
	}
	if contieneID(resp, inactivo.ID.String()) {
		t.Fatal("el alojamiento inactivo NO debería aparecer en el listado sin incluirInactivos")
	}
}

func TestList_IncluirInactivosSoloConCallerAdmin(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	inactivo := crearAlojamientoDePrueba(t, tx, func(a *db.Alojamiento) { a.Activo = false })

	// Sin token admin: incluirInactivos=true no tiene efecto.
	rec := httptest.NewRecorder()
	h.list(rec, reqConParam(http.MethodGet, "/alojamientos?incluirInactivos=true", nil, nil))
	var sinAdmin []alojamientoResponse
	mustUnmarshal(t, rec.Body.Bytes(), &sinAdmin)
	if contieneID(sinAdmin, inactivo.ID.String()) {
		t.Fatal("sin token admin, incluirInactivos no debería tener efecto")
	}

	// Con token admin: sí aparece.
	req := reqConParam(http.MethodGet, "/alojamientos?incluirInactivos=true", nil, nil)
	req.Header.Set("Authorization", "Bearer "+tokenPara(t, "administrador"))
	rec2 := httptest.NewRecorder()
	h.list(rec2, req)
	var conAdmin []alojamientoResponse
	mustUnmarshal(t, rec2.Body.Bytes(), &conAdmin)
	if !contieneID(conAdmin, inactivo.ID.String()) {
		t.Fatal("con token admin, incluirInactivos debería mostrar el inactivo")
	}
}

func TestList_FiltroDeHuespedes(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	chico := crearAlojamientoDePrueba(t, tx, func(a *db.Alojamiento) { a.Nombre = "Chico"; a.Capacidad = 2 })
	grande := crearAlojamientoDePrueba(t, tx, func(a *db.Alojamiento) { a.Nombre = "Grande"; a.Capacidad = 8 })

	rec := httptest.NewRecorder()
	h.list(rec, reqConParam(http.MethodGet, "/alojamientos?huespedes=6", nil, nil))

	var resp []alojamientoResponse
	mustUnmarshal(t, rec.Body.Bytes(), &resp)
	if !contieneID(resp, grande.ID.String()) {
		t.Fatal("el alojamiento grande (capacidad 8) debería aparecer con huespedes=6")
	}
	if contieneID(resp, chico.ID.String()) {
		t.Fatal("el alojamiento chico (capacidad 2) NO debería aparecer con huespedes=6")
	}
}

func TestList_HuespedesInvalidoDaBadRequest(t *testing.T) {
	h, _ := newAlojamientoHandler(t)
	rec := httptest.NewRecorder()
	h.list(rec, reqConParam(http.MethodGet, "/alojamientos?huespedes=no-es-numero", nil, nil))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

func TestList_RangoDeFechasSinLaOtraFechaDaBadRequest(t *testing.T) {
	h, _ := newAlojamientoHandler(t)
	rec := httptest.NewRecorder()
	h.list(rec, reqConParam(http.MethodGet, "/alojamientos?fecha_inicio=2026-09-01", nil, nil))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

func TestList_ExcluyeAlojamientoConReservaSolapada(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	usuario := crearUsuarioDePrueba(t, tx)
	libre := crearAlojamientoDePrueba(t, tx, func(a *db.Alojamiento) { a.Nombre = "Libre" })
	ocupado := crearAlojamientoDePrueba(t, tx, func(a *db.Alojamiento) { a.Nombre = "Ocupado" })

	inicio := clock.Today().AddDate(0, 0, 10)
	fin := clock.Today().AddDate(0, 0, 15)
	reserva := db.Reserva{
		UsuarioID:     usuario.ID,
		AlojamientoID: &ocupado.ID,
		Tipo:          "alojamiento",
		Estado:        "confirmada",
		FechaInicio:   &inicio,
		FechaFin:      &fin,
	}
	if err := tx.Create(&reserva).Error; err != nil {
		t.Fatalf("no se pudo crear la reserva de prueba: %v", err)
	}

	// Arma el query string con las mismas fechas de la reserva (relativas a
	// "hoy") en vez de fechas fijas, para no acoplar el test a cuándo corre.
	q := "/alojamientos?fecha_inicio=" + inicio.Format(dateLayout) + "&fecha_fin=" + fin.Format(dateLayout)
	rec := httptest.NewRecorder()
	h.list(rec, reqConParam(http.MethodGet, q, nil, nil))

	var resp []alojamientoResponse
	mustUnmarshal(t, rec.Body.Bytes(), &resp)
	if !contieneID(resp, libre.ID.String()) {
		t.Fatal("el alojamiento libre debería aparecer para ese rango de fechas")
	}
	if contieneID(resp, ocupado.ID.String()) {
		t.Fatal("el alojamiento con la reserva solapada NO debería aparecer para ese rango de fechas")
	}
}

// --- deactivate / activate ---

func TestDeactivate_PoneActivoEnFalse(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	a := crearAlojamientoDePrueba(t, tx, nil)

	rec := httptest.NewRecorder()
	h.deactivate(rec, reqConParam(http.MethodDelete, "/alojamientos/"+a.ID.String(), nil, map[string]string{"id": a.ID.String()}))

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusNoContent)
	}
	var recargado db.Alojamiento
	tx.First(&recargado, "id = ?", a.ID)
	if recargado.Activo {
		t.Fatal("el alojamiento debería quedar activo=false después de deactivate")
	}
}

func TestDeactivate_InexistenteDaNotFound(t *testing.T) {
	h, _ := newAlojamientoHandler(t)
	id := uuid.New().String()
	rec := httptest.NewRecorder()
	h.deactivate(rec, reqConParam(http.MethodDelete, "/alojamientos/"+id, nil, map[string]string{"id": id}))

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusNotFound)
	}
}

func TestActivate_PoneActivoEnTrue(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	a := crearAlojamientoDePrueba(t, tx, func(al *db.Alojamiento) { al.Activo = false })

	rec := httptest.NewRecorder()
	h.activate(rec, reqConParam(http.MethodPost, "/alojamientos/"+a.ID.String()+"/activar", nil, map[string]string{"id": a.ID.String()}))

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusNoContent)
	}
	var recargado db.Alojamiento
	tx.First(&recargado, "id = ?", a.ID)
	if !recargado.Activo {
		t.Fatal("el alojamiento debería quedar activo=true después de activate")
	}
}

func TestActivate_InexistenteDaNotFound(t *testing.T) {
	h, _ := newAlojamientoHandler(t)
	id := uuid.New().String()
	rec := httptest.NewRecorder()
	h.activate(rec, reqConParam(http.MethodPost, "/alojamientos/"+id+"/activar", nil, map[string]string{"id": id}))

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusNotFound)
	}
}

// --- disponibilidad ---

func TestDisponibilidad_DevuelveRangoOcupadoDeReservaVigente(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	a := crearAlojamientoDePrueba(t, tx, nil)
	usuario := crearUsuarioDePrueba(t, tx)

	inicio := clock.Today().AddDate(0, 0, 5)
	fin := clock.Today().AddDate(0, 0, 8)
	reserva := db.Reserva{
		UsuarioID: usuario.ID, AlojamientoID: &a.ID, Tipo: "alojamiento",
		Estado: "confirmada", FechaInicio: &inicio, FechaFin: &fin,
	}
	if err := tx.Create(&reserva).Error; err != nil {
		t.Fatalf("no se pudo crear la reserva de prueba: %v", err)
	}

	rec := httptest.NewRecorder()
	h.disponibilidad(rec, reqConParam(http.MethodGet, "/alojamientos/"+a.ID.String()+"/disponibilidad", nil, map[string]string{"id": a.ID.String()}))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusOK)
	}
	var resp struct {
		Ocupado []struct{ Inicio, Fin string } `json:"ocupado"`
	}
	mustUnmarshal(t, rec.Body.Bytes(), &resp)
	if len(resp.Ocupado) != 1 {
		t.Fatalf("esperaba 1 rango ocupado, dio %d", len(resp.Ocupado))
	}
}

func TestDisponibilidad_NoIncluyeReservaCancelada(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	a := crearAlojamientoDePrueba(t, tx, nil)
	usuario := crearUsuarioDePrueba(t, tx)

	inicio := clock.Today().AddDate(0, 0, 5)
	fin := clock.Today().AddDate(0, 0, 8)
	reserva := db.Reserva{
		UsuarioID: usuario.ID, AlojamientoID: &a.ID, Tipo: "alojamiento",
		Estado: "cancelada", FechaInicio: &inicio, FechaFin: &fin,
	}
	if err := tx.Create(&reserva).Error; err != nil {
		t.Fatalf("no se pudo crear la reserva de prueba: %v", err)
	}

	rec := httptest.NewRecorder()
	h.disponibilidad(rec, reqConParam(http.MethodGet, "/alojamientos/"+a.ID.String()+"/disponibilidad", nil, map[string]string{"id": a.ID.String()}))

	var resp struct {
		Ocupado []struct{ Inicio, Fin string } `json:"ocupado"`
	}
	mustUnmarshal(t, rec.Body.Bytes(), &resp)
	if len(resp.Ocupado) != 0 {
		t.Fatalf("una reserva cancelada no debería contar como ocupado, dio %d rangos", len(resp.Ocupado))
	}
}

func TestDisponibilidad_NoIncluyeReservaYaVencida(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	a := crearAlojamientoDePrueba(t, tx, nil)
	usuario := crearUsuarioDePrueba(t, tx)

	inicio := clock.Today().AddDate(0, 0, -10)
	fin := clock.Today().AddDate(0, 0, -5)
	reserva := db.Reserva{
		UsuarioID: usuario.ID, AlojamientoID: &a.ID, Tipo: "alojamiento",
		Estado: "confirmada", FechaInicio: &inicio, FechaFin: &fin,
	}
	if err := tx.Create(&reserva).Error; err != nil {
		t.Fatalf("no se pudo crear la reserva de prueba: %v", err)
	}

	rec := httptest.NewRecorder()
	h.disponibilidad(rec, reqConParam(http.MethodGet, "/alojamientos/"+a.ID.String()+"/disponibilidad", nil, map[string]string{"id": a.ID.String()}))

	var resp struct {
		Ocupado []struct{ Inicio, Fin string } `json:"ocupado"`
	}
	mustUnmarshal(t, rec.Body.Bytes(), &resp)
	if len(resp.Ocupado) != 0 {
		t.Fatalf("una reserva ya vencida no debería seguir bloqueando el calendario, dio %d rangos", len(resp.Ocupado))
	}
}

func TestDisponibilidad_IdInvalidoDaBadRequest(t *testing.T) {
	h, _ := newAlojamientoHandler(t)
	rec := httptest.NewRecorder()
	h.disponibilidad(rec, reqConParam(http.MethodGet, "/alojamientos/x/disponibilidad", nil, map[string]string{"id": "no-es-un-uuid"}))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

// --- update ---

func TestUpdate_ActualizaLosCampos(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	a := crearAlojamientoDePrueba(t, tx, nil)

	req := alojamientoValido()
	req.Nombre = "Nombre actualizado"
	req.PrecioNoche = 99999
	rec := httptest.NewRecorder()
	h.update(rec, reqConParam(http.MethodPut, "/alojamientos/"+a.ID.String(), jsonBody(t, req), map[string]string{"id": a.ID.String()}))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	var resp alojamientoResponse
	mustUnmarshal(t, rec.Body.Bytes(), &resp)
	if resp.Nombre != "Nombre actualizado" || resp.PrecioNoche != 99999 {
		t.Fatalf("los campos no se actualizaron: %+v", resp)
	}
}

func TestUpdate_IdInvalidoDaBadRequest(t *testing.T) {
	h, _ := newAlojamientoHandler(t)
	rec := httptest.NewRecorder()
	h.update(rec, reqConParam(http.MethodPut, "/alojamientos/x", jsonBody(t, alojamientoValido()), map[string]string{"id": "no-es-un-uuid"}))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

func TestUpdate_InexistenteDaNotFound(t *testing.T) {
	h, _ := newAlojamientoHandler(t)
	id := uuid.New().String()
	rec := httptest.NewRecorder()
	h.update(rec, reqConParam(http.MethodPut, "/alojamientos/"+id, jsonBody(t, alojamientoValido()), map[string]string{"id": id}))

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusNotFound)
	}
}

func TestUpdate_CuerpoInvalidoDaBadRequest(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	a := crearAlojamientoDePrueba(t, tx, nil)
	rec := httptest.NewRecorder()
	h.update(rec, reqConParam(http.MethodPut, "/alojamientos/"+a.ID.String(), stringBody("no es json"), map[string]string{"id": a.ID.String()}))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

func TestUpdate_DatosInvalidosDaBadRequest(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	a := crearAlojamientoDePrueba(t, tx, nil)
	req := alojamientoValido()
	req.Capacidad = 0
	rec := httptest.NewRecorder()
	h.update(rec, reqConParam(http.MethodPut, "/alojamientos/"+a.ID.String(), jsonBody(t, req), map[string]string{"id": a.ID.String()}))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

// Documenta a propósito el comportamiento actual (T4.19/TR-035): update()
// nunca toca `activo` — publicar es una acción explícita y separada
// (POST .../activar). Si algún día alguien "arregla" update() para que
// también reactive, este test avisa que cambió un comportamiento
// deliberado, no un bug.
func TestUpdate_NuncaReactivaUnAlojamientoDeBaja(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	a := crearAlojamientoDePrueba(t, tx, func(al *db.Alojamiento) { al.Activo = false })

	rec := httptest.NewRecorder()
	h.update(rec, reqConParam(http.MethodPut, "/alojamientos/"+a.ID.String(), jsonBody(t, alojamientoValido()), map[string]string{"id": a.ID.String()}))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	var recargado db.Alojamiento
	tx.First(&recargado, "id = ?", a.ID)
	if recargado.Activo {
		t.Fatal("update() no debería reactivar un alojamiento de baja — usar activate() para eso")
	}
}

// --- uploadFoto ---

func TestUploadFoto_ImagenValida(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	a := crearAlojamientoDePrueba(t, tx, nil)

	req := multipartRequest(t, "foto", "foto.png", pngSignature, map[string]string{"id": a.ID.String()})
	rec := httptest.NewRecorder()
	h.uploadFoto(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusCreated, rec.Body.String())
	}
	var resp fotoResponse
	mustUnmarshal(t, rec.Body.Bytes(), &resp)
	if resp.Tipo != "foto" {
		t.Fatalf("Tipo = %q, esperaba %q", resp.Tipo, "foto")
	}
}

func TestUploadFoto_VideoValido(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	a := crearAlojamientoDePrueba(t, tx, nil)

	req := multipartRequest(t, "foto", "video.webm", webmSignature, map[string]string{"id": a.ID.String()})
	rec := httptest.NewRecorder()
	h.uploadFoto(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusCreated, rec.Body.String())
	}
	var resp fotoResponse
	mustUnmarshal(t, rec.Body.Bytes(), &resp)
	if resp.Tipo != "video" {
		t.Fatalf("Tipo = %q, esperaba %q", resp.Tipo, "video")
	}
}

func TestUploadFoto_TipoNoPermitidoDaBadRequest(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	a := crearAlojamientoDePrueba(t, tx, nil)

	req := multipartRequest(t, "foto", "archivo.txt", []byte("esto no es ni una imagen ni un video"), map[string]string{"id": a.ID.String()})
	rec := httptest.NewRecorder()
	h.uploadFoto(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

func TestUploadFoto_AlojamientoInexistenteDaNotFound(t *testing.T) {
	h, _ := newAlojamientoHandler(t)
	id := uuid.New().String()
	req := multipartRequest(t, "foto", "foto.png", pngSignature, map[string]string{"id": id})
	rec := httptest.NewRecorder()
	h.uploadFoto(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusNotFound)
	}
}

func TestUploadFoto_IdInvalidoDaBadRequest(t *testing.T) {
	h, _ := newAlojamientoHandler(t)
	req := multipartRequest(t, "foto", "foto.png", pngSignature, map[string]string{"id": "no-es-un-uuid"})
	rec := httptest.NewRecorder()
	h.uploadFoto(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

func TestUploadFoto_FaltaElArchivoDaBadRequest(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	a := crearAlojamientoDePrueba(t, tx, nil)

	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	if err := w.Close(); err != nil {
		t.Fatalf("no se pudo cerrar el multipart writer: %v", err)
	}
	req := reqConParam(http.MethodPost, "/x", &buf, map[string]string{"id": a.ID.String()})
	req.Header.Set("Content-Type", w.FormDataContentType())

	rec := httptest.NewRecorder()
	h.uploadFoto(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

// T4.20: el pool de 10 espacios es compartido entre foto y video — al
// llegar al límite, ni una foto más entra, sin importar el tipo.
func TestUploadFoto_RechazaAlLlegarAlLimiteDeDiez(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	a := crearAlojamientoDePrueba(t, tx, nil)

	for i := 0; i < maxFotosPorAlojamiento; i++ {
		foto := db.Foto{AlojamientoID: a.ID, URL: "http://x/f.jpg", Orden: i, Tipo: "foto"}
		if err := tx.Create(&foto).Error; err != nil {
			t.Fatalf("no se pudo preparar la foto %d: %v", i, err)
		}
	}

	req := multipartRequest(t, "foto", "foto.png", pngSignature, map[string]string{"id": a.ID.String()})
	rec := httptest.NewRecorder()
	h.uploadFoto(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d (límite de %d ya alcanzado)", rec.Code, http.StatusBadRequest, maxFotosPorAlojamiento)
	}
}

func TestUploadFoto_ImagenSuperaElLimiteDeTamano(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	a := crearAlojamientoDePrueba(t, tx, nil)

	grande := make([]byte, len(pngSignature))
	copy(grande, pngSignature)
	grande = append(grande, make([]byte, maxImageUploadBytes+1)...)

	req := multipartRequest(t, "foto", "foto-grande.png", grande, map[string]string{"id": a.ID.String()})
	rec := httptest.NewRecorder()
	h.uploadFoto(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

// --- uploadPortada ---

func TestUploadPortada_ImagenValida(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	a := crearAlojamientoDePrueba(t, tx, nil)

	req := multipartRequest(t, "portada", "portada.png", pngSignature, map[string]string{"id": a.ID.String()})
	rec := httptest.NewRecorder()
	h.uploadPortada(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, esperaba %d — body: %s", rec.Code, http.StatusCreated, rec.Body.String())
	}
	var resp fotoResponse
	mustUnmarshal(t, rec.Body.Bytes(), &resp)
	if !resp.EsPortada {
		t.Fatal("la foto subida como portada debería tener esPortada=true")
	}
}

func TestUploadPortada_RechazaVideo(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	a := crearAlojamientoDePrueba(t, tx, nil)

	req := multipartRequest(t, "portada", "video.webm", webmSignature, map[string]string{"id": a.ID.String()})
	rec := httptest.NewRecorder()
	h.uploadPortada(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d — la portada nunca puede ser un video", rec.Code, http.StatusBadRequest)
	}
}

// Reemplazar la portada desmarca la anterior — a lo sumo una fila con
// EsPortada=true por alojamiento (comentario del handler).
func TestUploadPortada_DesmarcaLaPortadaAnterior(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	a := crearAlojamientoDePrueba(t, tx, nil)

	primera := multipartRequest(t, "portada", "p1.png", pngSignature, map[string]string{"id": a.ID.String()})
	h.uploadPortada(httptest.NewRecorder(), primera)

	segunda := multipartRequest(t, "portada", "p2.png", pngSignature, map[string]string{"id": a.ID.String()})
	rec := httptest.NewRecorder()
	h.uploadPortada(rec, segunda)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusCreated)
	}

	var totalPortadas int64
	tx.Model(&db.Foto{}).Where("alojamiento_id = ? AND es_portada = ?", a.ID, true).Count(&totalPortadas)
	if totalPortadas != 1 {
		t.Fatalf("esperaba exactamente 1 foto marcada como portada, hay %d", totalPortadas)
	}
}

func TestUploadPortada_AlojamientoInexistenteDaNotFound(t *testing.T) {
	h, _ := newAlojamientoHandler(t)
	id := uuid.New().String()
	req := multipartRequest(t, "portada", "portada.png", pngSignature, map[string]string{"id": id})
	rec := httptest.NewRecorder()
	h.uploadPortada(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusNotFound)
	}
}

// --- deleteFoto ---

func TestDeleteFoto_BorraLaFotoExistente(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	a := crearAlojamientoDePrueba(t, tx, nil)
	foto := db.Foto{AlojamientoID: a.ID, URL: "http://x/f.jpg", Tipo: "foto"}
	tx.Create(&foto)

	rec := httptest.NewRecorder()
	h.deleteFoto(rec, reqConParam(http.MethodDelete, "/x", nil, map[string]string{"id": a.ID.String(), "fotoId": foto.ID.String()}))

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusNoContent)
	}
	var count int64
	tx.Model(&db.Foto{}).Where("id = ?", foto.ID).Count(&count)
	if count != 0 {
		t.Fatal("la foto debería haberse borrado")
	}
}

func TestDeleteFoto_InexistenteDaNotFound(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	a := crearAlojamientoDePrueba(t, tx, nil)
	fotoID := uuid.New().String()

	rec := httptest.NewRecorder()
	h.deleteFoto(rec, reqConParam(http.MethodDelete, "/x", nil, map[string]string{"id": a.ID.String(), "fotoId": fotoID}))

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusNotFound)
	}
}

// Una foto de OTRO alojamiento no se puede borrar pasando el id de este
// — el Where("... AND alojamiento_id = ?") tiene que acotar de verdad.
func TestDeleteFoto_DeOtroAlojamientoDaNotFound(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	a1 := crearAlojamientoDePrueba(t, tx, func(al *db.Alojamiento) { al.Nombre = "Uno" })
	a2 := crearAlojamientoDePrueba(t, tx, func(al *db.Alojamiento) { al.Nombre = "Dos" })
	foto := db.Foto{AlojamientoID: a2.ID, URL: "http://x/f.jpg", Tipo: "foto"}
	tx.Create(&foto)

	rec := httptest.NewRecorder()
	h.deleteFoto(rec, reqConParam(http.MethodDelete, "/x", nil, map[string]string{"id": a1.ID.String(), "fotoId": foto.ID.String()}))

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusNotFound)
	}
}

func TestDeleteFoto_IdsInvalidosDanBadRequest(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	a := crearAlojamientoDePrueba(t, tx, nil)

	rec := httptest.NewRecorder()
	h.deleteFoto(rec, reqConParam(http.MethodDelete, "/x", nil, map[string]string{"id": "no-es-un-uuid", "fotoId": uuid.NewString()}))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("id de alojamiento inválido: status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}

	rec2 := httptest.NewRecorder()
	h.deleteFoto(rec2, reqConParam(http.MethodDelete, "/x", nil, map[string]string{"id": a.ID.String(), "fotoId": "no-es-un-uuid"}))
	if rec2.Code != http.StatusBadRequest {
		t.Fatalf("id de foto inválido: status = %d, esperaba %d", rec2.Code, http.StatusBadRequest)
	}
}

// --- reordenarFotos ---

func TestReordenarFotos_PersisteElNuevoOrden(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	a := crearAlojamientoDePrueba(t, tx, nil)

	f1 := db.Foto{AlojamientoID: a.ID, URL: "http://x/1.jpg", Orden: 0, Tipo: "foto"}
	f2 := db.Foto{AlojamientoID: a.ID, URL: "http://x/2.jpg", Orden: 1, Tipo: "foto"}
	tx.Create(&f1)
	tx.Create(&f2)

	body := jsonBody(t, reordenarFotosRequest{Orden: []string{f2.ID.String(), f1.ID.String()}})
	rec := httptest.NewRecorder()
	h.reordenarFotos(rec, reqConParam(http.MethodPatch, "/x", body, map[string]string{"id": a.ID.String()}))

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusNoContent)
	}

	var f1Recargada, f2Recargada db.Foto
	tx.First(&f1Recargada, "id = ?", f1.ID)
	tx.First(&f2Recargada, "id = ?", f2.ID)
	if f2Recargada.Orden != 0 || f1Recargada.Orden != 1 {
		t.Fatalf("orden no persistido correctamente: f1.Orden=%d f2.Orden=%d, esperaba f1=1 f2=0", f1Recargada.Orden, f2Recargada.Orden)
	}
}

func TestReordenarFotos_IdDeAlojamientoInvalidoDaBadRequest(t *testing.T) {
	h, _ := newAlojamientoHandler(t)
	body := jsonBody(t, reordenarFotosRequest{Orden: []string{uuid.NewString()}})
	rec := httptest.NewRecorder()
	h.reordenarFotos(rec, reqConParam(http.MethodPatch, "/x", body, map[string]string{"id": "no-es-un-uuid"}))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

func TestReordenarFotos_CuerpoInvalidoDaBadRequest(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	a := crearAlojamientoDePrueba(t, tx, nil)
	rec := httptest.NewRecorder()
	h.reordenarFotos(rec, reqConParam(http.MethodPatch, "/x", stringBody("no es json"), map[string]string{"id": a.ID.String()}))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

func TestReordenarFotos_IdDeFotoInvalidoDaBadRequest(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	a := crearAlojamientoDePrueba(t, tx, nil)
	body := jsonBody(t, reordenarFotosRequest{Orden: []string{"no-es-un-uuid"}})
	rec := httptest.NewRecorder()
	h.reordenarFotos(rec, reqConParam(http.MethodPatch, "/x", body, map[string]string{"id": a.ID.String()}))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, esperaba %d", rec.Code, http.StatusBadRequest)
	}
}

// Un id de foto que pertenece a OTRO alojamiento no debe poder
// reordenarse a través de este — el Where acota por alojamiento_id, así
// que el Update no afecta ninguna fila (comportamiento documentado en el
// comentario del handler: no es un error, simplemente no hace nada).
func TestReordenarFotos_IdDeOtroAlojamientoNoAfectaNada(t *testing.T) {
	h, tx := newAlojamientoHandler(t)
	a1 := crearAlojamientoDePrueba(t, tx, func(al *db.Alojamiento) { al.Nombre = "Uno" })
	a2 := crearAlojamientoDePrueba(t, tx, func(al *db.Alojamiento) { al.Nombre = "Dos" })
	fotoDeA2 := db.Foto{AlojamientoID: a2.ID, URL: "http://x/f.jpg", Orden: 5, Tipo: "foto"}
	tx.Create(&fotoDeA2)

	body := jsonBody(t, reordenarFotosRequest{Orden: []string{fotoDeA2.ID.String()}})
	rec := httptest.NewRecorder()
	h.reordenarFotos(rec, reqConParam(http.MethodPatch, "/x", body, map[string]string{"id": a1.ID.String()}))

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, esperaba %d (no es un error, simplemente no afecta nada)", rec.Code, http.StatusNoContent)
	}
	var recargada db.Foto
	tx.First(&recargada, "id = ?", fotoDeA2.ID)
	if recargada.Orden != 5 {
		t.Fatalf("el orden de la foto de otro alojamiento no debería haber cambiado, quedó en %d", recargada.Orden)
	}
}
