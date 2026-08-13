# apps/api — build en dos etapas para que la imagen final no cargue el
# toolchain de Go, solo los binarios ya compilados.
#
# Build context: este Dockerfile asume que se construye con contexto
# `apps/api` (ver docker-compose.yml, build.context: ./apps/api) — es un
# módulo Go independiente, no necesita nada del resto del monorepo.

FROM golang:1.25-alpine AS build
WORKDIR /src

# Cachea `go mod download` en su propia capa: solo se re-ejecuta si
# go.mod/go.sum cambian, no en cada cambio de código.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# CGO_ENABLED=0 para un binario estático que corre en la imagen final
# distroless/alpine sin depender de libc del builder.
RUN CGO_ENABLED=0 go build -o /out/api ./cmd/api
RUN CGO_ENABLED=0 go build -o /out/migrate ./cmd/migrate

FROM alpine:3.20 AS runtime
# ca-certificates: necesario si en el futuro el backend hace requests
# salientes por HTTPS (p. ej. Resend real en vez de LogSender, TR-014).
RUN apk add --no-cache ca-certificates
WORKDIR /app

COPY --from=build /out/api /app/api
COPY --from=build /out/migrate /app/migrate

# UPLOADS_DIR (TR-013) — directorio donde LocalStorage guarda las fotos.
# Se monta como volumen en docker-compose.yml para persistir entre
# reinicios del contenedor.
RUN mkdir -p /app/uploads

EXPOSE 8080
CMD ["/app/api"]
