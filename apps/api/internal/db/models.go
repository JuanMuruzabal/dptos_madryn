package db

import (
	"time"

	"github.com/google/uuid"
)

// Modelos GORM del esquema inicial (turismo-marcuzzi-spec.md §5).
// Experiencia, Slot y Pago se agregan en Sprint 6 / Fase 3 del plan de
// implementación — no forman parte de T0.3.

// Usuario refleja la entidad USUARIO del ERD.
type Usuario struct {
	ID     uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Nombre string    `gorm:"type:varchar(150);not null"`
	// Email: SIN uniqueIndex acá a propósito (2026-08-18, pedido explícito
	// del cliente) — una cuenta de Google y una cuenta nativa (contraseña)
	// pueden compartir el mismo email sin ser la misma cuenta. La
	// unicidad real es un índice único PARCIAL sobre (email) WHERE
	// google_id IS NULL — como máximo una cuenta NATIVA por email, pero
	// sin restricción entre una nativa y una de Google (ver migrate.go,
	// idx_usuarios_email_nativo).
	Email        string  `gorm:"type:varchar(255);not null"`
	PasswordHash string  `gorm:"column:password_hash;type:varchar(255);not null"`
	Telefono     *string `gorm:"type:varchar(50)"`
	// rol: 'cliente' | 'administrador' (spec §4.5).
	Rol string `gorm:"type:varchar(20);not null;default:cliente;check:rol IN ('cliente','administrador')"`

	// --- Confirmación de cuenta por email (Prompt 2 de docs/prompts-login
	// (1).md, 2026-08-18) ---
	// EmailConfirmado empieza en false al registrarse por email/contraseña
	// — la cuenta no puede loguearse hasta confirmar el código (ver
	// internal/http/auth.go). Las cuentas creadas vía Google (abajo)
	// arrancan en true directo: Google ya verifica el email por su cuenta,
	// pedirles un segundo código sería fricción sin ganancia de seguridad
	// real.
	EmailConfirmado bool `gorm:"column:email_confirmado;not null;default:false"`
	// CodigoConfirmacion/CodigoExpiracion: nil cuando no hay un código
	// pendiente (cuenta ya confirmada, o cuenta Google que nunca tuvo
	// uno). Se pisan en cada reenvío — un código viejo deja de servir en
	// cuanto se pide uno nuevo, no solo cuando expira solo.
	CodigoConfirmacion *string    `gorm:"column:codigo_confirmacion;type:varchar(10)"`
	CodigoExpiracion   *time.Time `gorm:"column:codigo_expiracion"`

	// --- Google Sign-In (Prompt 2) ---
	// GoogleID es el "sub" (subject) que devuelve la cuenta de Google —
	// identificador estable de esa cuenta de Google, nunca cambia (a
	// diferencia del email, que en teoría el usuario podría cambiar del
	// lado de Google). Nullable + uniqueIndex: la mayoría de los usuarios
	// (alta por email/contraseña) no tienen uno.
	GoogleID *string `gorm:"column:google_id;type:varchar(255);uniqueIndex"`

	CreatedAt time.Time
	UpdatedAt time.Time
}

func (Usuario) TableName() string { return "usuarios" }

// Alojamiento refleja la entidad ALOJAMIENTO del ERD.
type Alojamiento struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Nombre      string    `gorm:"type:varchar(200);not null"`
	Descripcion string    `gorm:"type:text"`
	Lat         float64   `gorm:"not null"`
	Lng         float64   `gorm:"not null"`
	Direccion   string    `gorm:"type:varchar(255)"`
	PrecioNoche float64   `gorm:"column:precio_noche;type:numeric(10,2);not null"`
	Capacidad   int       `gorm:"not null;default:1"`
	Activo      bool      `gorm:"not null;default:true"`
	Fotos       []Foto    `gorm:"foreignKey:AlojamientoID"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func (Alojamiento) TableName() string { return "alojamientos" }

// Foto refleja la entidad FOTO del ERD (ALOJAMIENTO ||--o{ FOTO). Tipo
// (T4.13, pedido del cliente 2026-08-13) permite que la misma tabla/mismo
// endpoint de carga sirvan también video (recorridos del depto) — no se
// creó una entidad "Video" aparte para no duplicar todo el mecanismo de
// orden/galería/borrado que ya existe para fotos.
type Foto struct {
	ID            uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	AlojamientoID uuid.UUID `gorm:"column:alojamiento_id;type:uuid;not null;index"`
	URL           string    `gorm:"column:url;type:text;not null"`
	Orden         int       `gorm:"not null;default:0"`
	Tipo          string    `gorm:"type:varchar(10);not null;default:foto;check:tipo IN ('foto','video')"`
	// EsPortada (T4.14, pedido del cliente 2026-08-13) — la foto que se
	// usa como miniatura en la tarjeta del listado de Alojamiento
	// (distinta de la galería completa que se ve en el detalle). A lo
	// sumo una fila en true por alojamiento — subirFotoPortada (T4.14)
	// se encarga de desmarcar cualquier portada anterior. Nunca es un
	// video (la tarjeta del listado necesita una imagen fija).
	EsPortada bool `gorm:"column:es_portada;not null;default:false"`
	CreatedAt time.Time
}

func (Foto) TableName() string { return "fotos" }

// ContenidoSitio (T4.13) — bloques de texto editables de páginas
// principales que no son un alojamiento puntual (p. ej. el título/
// descripción del listado de Alojamiento). Clave fija conocida por el
// código (no hay UI para crear claves nuevas) — es un mapa clave→texto
// muy simple a propósito, no un CMS genérico: cubre exactamente los
// pedidos actuales (spec del cliente, 2026-08-13), no una plataforma de
// contenido para cualquier página futura.
type ContenidoSitio struct {
	Clave       string `gorm:"primaryKey;type:varchar(80)"`
	Titulo      string `gorm:"type:text;not null;default:''"`
	Descripcion string `gorm:"type:text;not null;default:''"`
	UpdatedAt   time.Time
}

func (ContenidoSitio) TableName() string { return "contenidos_sitio" }

// ImagenSitio (T4.13) — fotos editables de las páginas principales que no
// están atadas a un alojamiento (el hero de la home, las tarjetas de
// categoría) — "editor de página" del panel admin. Mismo criterio de
// clave fija que ContenidoSitio. Sin fila para una clave dada, la página
// pública sigue mostrando su gradiente de marca por defecto (ver
// components/scene.tsx) — nunca un <img> roto.
type ImagenSitio struct {
	Clave     string `gorm:"primaryKey;type:varchar(80)"`
	URL       string `gorm:"type:text;not null"`
	UpdatedAt time.Time
}

func (ImagenSitio) TableName() string { return "imagenes_sitio" }

// Reserva refleja la entidad RESERVA del ERD. AlojamientoID es nullable
// porque en Fase 2 (Sprint 6-7) también habrá reservas de experiencia
// (via slot) y de traslado, sin alojamiento asociado.
//
// FechaInicio/FechaFin alimentan una columna generada `rango_fechas
// daterange` (ver migrate.go) sobre la que corre el exclusion constraint
// que evita dobles reservas (spec §5, "Nota clave sobre reservas de
// alojamiento") — sigue cubriendo cualquier reserva activa
// (estado <> 'cancelada'), pendiente incluida: dos pendientes solapadas
// tampoco pueden coexistir (decisión del cliente, 2026-08-12, ver TR-015).
//
// Los campos Contacto* son un snapshot de contacto para ESTA reserva
// puntual (T3.5) — no tocan el perfil del usuario (Usuario.Nombre/
// Telefono): alguien puede reservar para otra persona, o simplemente
// preferir otro teléfono para esa estadía. Se piden en el formulario que
// se abre al reservar, precargados desde la cuenta cuando hay dato.
type Reserva struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	UsuarioID uuid.UUID `gorm:"column:usuario_id;type:uuid;not null;index"`
	// Usuario — quién hizo la reserva (T4.4, listado admin). No se precarga
	// en las consultas del propio cliente (/me/reservas ya está scopeada a
	// su usuario_id, sería redundante), solo en el listado admin.
	Usuario       Usuario      `gorm:"foreignKey:UsuarioID"`
	AlojamientoID *uuid.UUID   `gorm:"column:alojamiento_id;type:uuid;index"`
	Alojamiento   *Alojamiento `gorm:"foreignKey:AlojamientoID"`
	// tipo: 'alojamiento' | 'experiencia' | 'traslado'.
	Tipo string `gorm:"type:varchar(20);not null;check:tipo IN ('alojamiento','experiencia','traslado')"`
	// estado: 'pendiente' | 'confirmada' | 'cancelada' (spec §4.6). Una
	// reserva 'pendiente' vence sola a los 20 minutos si nadie la
	// confirma — salvo que ContactadoEn ya esté seteado (T3.6): tocar el
	// botón de WhatsApp/mail apaga el timer, ver
	// internal/reservas.ExpirePendientes (T3.5/T3.6, TR-015).
	Estado           string     `gorm:"type:varchar(20);not null;default:pendiente;check:estado IN ('pendiente','confirmada','cancelada')"`
	FechaInicio      *time.Time `gorm:"column:fecha_inicio;type:date"`
	FechaFin         *time.Time `gorm:"column:fecha_fin;type:date"`
	Total            float64    `gorm:"type:numeric(10,2);not null;default:0"`
	ContactoNombre   string     `gorm:"column:contacto_nombre;type:varchar(100);not null;default:''"`
	ContactoApellido string     `gorm:"column:contacto_apellido;type:varchar(100);not null;default:''"`
	ContactoDNI      string     `gorm:"column:contacto_dni;type:varchar(20);not null;default:''"`
	ContactoEmail    string     `gorm:"column:contacto_email;type:varchar(255);not null;default:''"`
	ContactoTelefono string     `gorm:"column:contacto_telefono;type:varchar(50);not null;default:''"`
	ContactadoEn     *time.Time `gorm:"column:contactado_en"`
	// EsBloqueoAdmin (T4.3, Sprint 4) — reutiliza esta misma tabla/columna
	// rango_fechas/exclusion constraint para los bloqueos manuales de fechas
	// del admin, en vez de una tabla nueva: un bloqueo es una fila con
	// UsuarioID = el propio admin que lo creó, Estado = 'confirmada' (ocupa
	// el calendario de verdad, sin flujo de pago/vencimiento) y este flag en
	// true. Así hereda gratis el exclusion constraint (no puede solaparse ni
	// con una reserva real ni con otro bloqueo) y el filtro de disponibilidad
	// existente (`estado <> 'cancelada'`) sin tocar esas consultas — ver
	// TR-019. Se filtra explícitamente afuera de /me/reservas y del listado
	// de reservas entrantes del admin (T4.4), que solo deben ver reservas de
	// clientes reales.
	EsBloqueoAdmin bool   `gorm:"column:es_bloqueo_admin;not null;default:false"`
	BloqueoMotivo  string `gorm:"column:bloqueo_motivo;type:varchar(255);not null;default:''"`
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

func (Reserva) TableName() string { return "reservas" }

// Resena refleja la entidad RESENA del ERD. AlojamientoID es nullable por
// la misma razón que en Reserva (en Fase 2 también habrá reseñas de
// experiencia). Usuario se precarga (T3.4) para mostrar quién dejó cada
// reseña sin una consulta aparte por fila.
type Resena struct {
	ID            uuid.UUID    `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	UsuarioID     uuid.UUID    `gorm:"column:usuario_id;type:uuid;not null;index"`
	Usuario       Usuario      `gorm:"foreignKey:UsuarioID"`
	AlojamientoID *uuid.UUID   `gorm:"column:alojamiento_id;type:uuid;index"`
	Alojamiento   *Alojamiento `gorm:"foreignKey:AlojamientoID"`
	Rating        int          `gorm:"not null;check:rating BETWEEN 1 AND 5"`
	Texto         string       `gorm:"type:text"`
	// Oculta (T4.5, moderación) — soft delete: el admin puede esconder una
	// reseña del listado público sin borrarla de la base (spec §4.8, "sin
	// borrarla de la DB"). El listado público filtra oculta = false; el
	// panel admin ve todas.
	Oculta    bool `gorm:"not null;default:false"`
	CreatedAt time.Time
}

func (Resena) TableName() string { return "resenas" }
