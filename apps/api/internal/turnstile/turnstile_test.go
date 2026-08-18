package turnstile

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// apuntaA reemplaza verifyURL por un httptest.Server para todo el test, y
// lo restaura al terminar — nunca se pega a la Cloudflare real acá.
func apuntaA(t *testing.T, handler http.HandlerFunc) {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	original := verifyURL
	verifyURL = server.URL
	t.Cleanup(func() { verifyURL = original })
}

func TestHTTPVerifier_TokenVacioNoPegaALaRed(t *testing.T) {
	llamado := false
	apuntaA(t, func(w http.ResponseWriter, r *http.Request) {
		llamado = true
		_, _ = w.Write([]byte(`{"success":true}`))
	})

	ok, err := HTTPVerifier{Secret: "s"}.Verify("", "1.2.3.4")
	if err != nil {
		t.Fatalf("err = %v, esperaba nil", err)
	}
	if ok {
		t.Error("token vacío debería dar false")
	}
	if llamado {
		t.Error("no debería haber pegado a la red con un token vacío")
	}
}

func TestHTTPVerifier_TokenValidoDaTrue(t *testing.T) {
	var secretRecibido, tokenRecibido, ipRecibida string
	apuntaA(t, func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		secretRecibido = r.FormValue("secret")
		tokenRecibido = r.FormValue("response")
		ipRecibida = r.FormValue("remoteip")
		_, _ = w.Write([]byte(`{"success":true}`))
	})

	ok, err := HTTPVerifier{Secret: "mi-secret"}.Verify("token-real", "1.2.3.4")
	if err != nil {
		t.Fatalf("err = %v, esperaba nil", err)
	}
	if !ok {
		t.Error("esperaba true")
	}
	if secretRecibido != "mi-secret" || tokenRecibido != "token-real" || ipRecibida != "1.2.3.4" {
		t.Errorf("form recibido = secret:%q response:%q remoteip:%q", secretRecibido, tokenRecibido, ipRecibida)
	}
}

func TestHTTPVerifier_RechazadoPorCloudflareDaFalse(t *testing.T) {
	apuntaA(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"success":false,"error-codes":["invalid-input-response"]}`))
	})

	ok, err := HTTPVerifier{Secret: "s"}.Verify("token-invalido", "")
	if err != nil {
		t.Fatalf("err = %v, esperaba nil", err)
	}
	if ok {
		t.Error("esperaba false")
	}
}

func TestHTTPVerifier_ErrorDeRedDevuelveError(t *testing.T) {
	original := verifyURL
	verifyURL = "http://127.0.0.1:0" // puerto inválido, la conexión falla siempre
	t.Cleanup(func() { verifyURL = original })

	_, err := HTTPVerifier{Secret: "s"}.Verify("token", "")
	if err == nil {
		t.Error("esperaba un error de red")
	}
}

func TestHTTPVerifier_RespuestaNoJSONDevuelveError(t *testing.T) {
	apuntaA(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("no soy json"))
	})

	_, err := HTTPVerifier{Secret: "s"}.Verify("token", "")
	if err == nil {
		t.Error("esperaba un error de parseo")
	}
}

func TestHTTPVerifier_SinClientPropioUsaElDefault(t *testing.T) {
	apuntaA(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"success":true}`))
	})

	v := HTTPVerifier{Secret: "s"} // Client queda nil
	ok, err := v.Verify("token", "")
	if err != nil || !ok {
		t.Fatalf("ok=%v err=%v, esperaba true/nil", ok, err)
	}
}
