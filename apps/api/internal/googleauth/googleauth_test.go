package googleauth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

// apuntaTokenA/apuntaUserinfoA reemplazan tokenURL/userinfoURL por
// httptest.Server para todo el test, y los restauran al terminar — mismo
// patrón que internal/turnstile, nunca le pegan a Google de verdad.
func apuntaTokenA(t *testing.T, handler http.HandlerFunc) {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	original := tokenURL
	tokenURL = server.URL
	t.Cleanup(func() { tokenURL = original })
}

func apuntaUserinfoA(t *testing.T, handler http.HandlerFunc) {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	original := userinfoURL
	userinfoURL = server.URL
	t.Cleanup(func() { userinfoURL = original })
}

func tokenOK(w http.ResponseWriter, r *http.Request) {
	_, _ = w.Write([]byte(`{"access_token":"el-access-token"}`))
}

func userinfoOK(w http.ResponseWriter, r *http.Request) {
	_, _ = w.Write([]byte(`{"sub":"12345","email":"ana@example.com","email_verified":true,"name":"Ana Pérez"}`))
}

func TestHTTPExchanger_FlujoCompletoExitoso(t *testing.T) {
	var formRecibido, authHeaderRecibido string
	apuntaTokenA(t, func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		formRecibido = r.Form.Encode()
		tokenOK(w, r)
	})
	apuntaUserinfoA(t, func(w http.ResponseWriter, r *http.Request) {
		authHeaderRecibido = r.Header.Get("Authorization")
		userinfoOK(w, r)
	})

	e := HTTPExchanger{ClientID: "cid", ClientSecret: "csecret"}
	user, err := e.Exchange(context.Background(), "el-code")
	if err != nil {
		t.Fatalf("err = %v, esperaba nil", err)
	}

	if user.Sub != "12345" || user.Email != "ana@example.com" || !user.EmailVerified || user.Name != "Ana Pérez" {
		t.Errorf("user = %+v", user)
	}
	if authHeaderRecibido != "Bearer el-access-token" {
		t.Errorf("Authorization a userinfo = %q", authHeaderRecibido)
	}
	// redirect_uri="postmessage" (flujo popup) y las credenciales viajan.
	form, err := url.ParseQuery(formRecibido)
	if err != nil {
		t.Fatalf("no se pudo parsear el form recibido: %v", err)
	}
	if form.Get("code") != "el-code" || form.Get("client_id") != "cid" || form.Get("client_secret") != "csecret" ||
		form.Get("redirect_uri") != "postmessage" || form.Get("grant_type") != "authorization_code" {
		t.Errorf("form al token endpoint = %q", formRecibido)
	}
}

func TestHTTPExchanger_GoogleRechazaElCode(t *testing.T) {
	apuntaTokenA(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"error":"invalid_grant","error_description":"code ya usado"}`))
	})

	e := HTTPExchanger{ClientID: "cid", ClientSecret: "csecret"}
	_, err := e.Exchange(context.Background(), "code-invalido")
	if err == nil {
		t.Fatal("esperaba un error")
	}
}

func TestHTTPExchanger_SinAccessTokenEnLaRespuestaDaError(t *testing.T) {
	apuntaTokenA(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{}`))
	})

	e := HTTPExchanger{ClientID: "cid", ClientSecret: "csecret"}
	_, err := e.Exchange(context.Background(), "code")
	if err == nil {
		t.Fatal("esperaba un error")
	}
}

func TestHTTPExchanger_TokenRespuestaNoJSONDaError(t *testing.T) {
	apuntaTokenA(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("no soy json"))
	})

	e := HTTPExchanger{ClientID: "cid", ClientSecret: "csecret"}
	_, err := e.Exchange(context.Background(), "code")
	if err == nil {
		t.Fatal("esperaba un error de parseo")
	}
}

func TestHTTPExchanger_ErrorDeRedEnElTokenDevuelveError(t *testing.T) {
	original := tokenURL
	tokenURL = "http://127.0.0.1:0"
	t.Cleanup(func() { tokenURL = original })

	e := HTTPExchanger{ClientID: "cid", ClientSecret: "csecret"}
	_, err := e.Exchange(context.Background(), "code")
	if err == nil {
		t.Error("esperaba un error de red")
	}
}

func TestHTTPExchanger_UserinfoNoOKDaError(t *testing.T) {
	apuntaTokenA(t, tokenOK)
	apuntaUserinfoA(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	})

	e := HTTPExchanger{ClientID: "cid", ClientSecret: "csecret"}
	_, err := e.Exchange(context.Background(), "code")
	if err == nil {
		t.Fatal("esperaba un error")
	}
}

func TestHTTPExchanger_UserinfoSinEmailDaError(t *testing.T) {
	apuntaTokenA(t, tokenOK)
	apuntaUserinfoA(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"sub":"12345"}`))
	})

	e := HTTPExchanger{ClientID: "cid", ClientSecret: "csecret"}
	_, err := e.Exchange(context.Background(), "code")
	if err == nil {
		t.Fatal("esperaba un error")
	}
}

func TestHTTPExchanger_UserinfoRespuestaNoJSONDaError(t *testing.T) {
	apuntaTokenA(t, tokenOK)
	apuntaUserinfoA(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("no soy json"))
	})

	e := HTTPExchanger{ClientID: "cid", ClientSecret: "csecret"}
	_, err := e.Exchange(context.Background(), "code")
	if err == nil {
		t.Fatal("esperaba un error de parseo")
	}
}

func TestHTTPExchanger_ErrorDeRedEnUserinfoDevuelveError(t *testing.T) {
	apuntaTokenA(t, tokenOK)
	original := userinfoURL
	userinfoURL = "http://127.0.0.1:0"
	t.Cleanup(func() { userinfoURL = original })

	e := HTTPExchanger{ClientID: "cid", ClientSecret: "csecret"}
	_, err := e.Exchange(context.Background(), "code")
	if err == nil {
		t.Error("esperaba un error de red")
	}
}

func TestHTTPExchanger_SinClientPropioUsaElDefault(t *testing.T) {
	apuntaTokenA(t, tokenOK)
	apuntaUserinfoA(t, userinfoOK)

	e := HTTPExchanger{ClientID: "cid", ClientSecret: "csecret"} // Client queda nil
	user, err := e.Exchange(context.Background(), "code")
	if err != nil {
		t.Fatalf("err = %v, esperaba nil", err)
	}
	if user.Email != "ana@example.com" {
		t.Errorf("user.Email = %q", user.Email)
	}
}

// HTTPExchanger cumple la interfaz Exchanger.
func TestHTTPExchanger_CumpleLaInterfazExchanger(t *testing.T) {
	var _ Exchanger = HTTPExchanger{}
}
