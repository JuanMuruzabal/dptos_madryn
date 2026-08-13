package db

import (
	"fmt"

	"gorm.io/gorm"
)

// RunMigrations aplica el esquema inicial (spec §5): AutoMigrate de GORM
// para las tablas base, y a continuación el SQL crudo que GORM no puede
// expresar — la extensión btree_gist, la columna generada `rango_fechas`
// (daterange) y el exclusion constraint que evita dobles reservas de
// alojamiento (ver "Nota clave sobre reservas de alojamiento" en la spec y
// TR-005/TR-006 en docs/tradeoffs.md). Es idempotente: se puede correr
// muchas veces sin error.
func RunMigrations(gdb *gorm.DB) error {
	if err := gdb.AutoMigrate(
		&Usuario{}, &Alojamiento{}, &Foto{}, &Reserva{}, &Resena{},
		&ContenidoSitio{}, &ImagenSitio{},
	); err != nil {
		return fmt.Errorf("automigrate: %w", err)
	}

	statements := []string{
		`CREATE EXTENSION IF NOT EXISTS btree_gist`,

		// Columna generada: se recalcula sola a partir de fecha_inicio/fecha_fin.
		// Con ambos extremos NULL (reservas de experiencia/traslado, que no usan
		// este rango) da un rango infinito "(,)" — pero como esas filas siempre
		// tienen alojamiento_id NULL, el exclusion constraint de abajo nunca las
		// compara contra nada (ver comentario en la constraint).
		`ALTER TABLE reservas
		   ADD COLUMN IF NOT EXISTS rango_fechas daterange
		   GENERATED ALWAYS AS (daterange(fecha_inicio, fecha_fin, '[]')) STORED`,

		// Cierra el hueco anterior: una reserva de tipo 'alojamiento' no puede
		// tener alojamiento_id/fechas nulos (evita que termine con un
		// rango_fechas infinito que bloquee ese alojamiento para siempre).
		`DO $$ BEGIN
		   ALTER TABLE reservas ADD CONSTRAINT chk_reserva_alojamiento_fechas
		     CHECK (
		       tipo <> 'alojamiento'
		       OR (alojamiento_id IS NOT NULL AND fecha_inicio IS NOT NULL
		           AND fecha_fin IS NOT NULL AND fecha_fin > fecha_inicio)
		     );
		 EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

		// La constraint central del proyecto: a nivel de base de datos, dos
		// reservas activas (estado <> 'cancelada') del mismo alojamiento no
		// pueden tener rangos de fechas que se solapen. alojamiento_id NULL
		// (reservas de experiencia/traslado) nunca conflictúa, porque la
		// igualdad "alojamiento_id WITH =" no se satisface contra NULL.
		// Nota: a diferencia de una CHECK constraint (que reintentada da
		// duplicate_object/42710), un EXCLUDE constraint crea por debajo un
		// índice con el mismo nombre, así que Postgres rechaza el duplicado
		// como duplicate_table/42P07 ("relation ... already exists") — hay
		// que atrapar ambos códigos para que esto sea realmente idempotente.
		`DO $$ BEGIN
		   ALTER TABLE reservas ADD CONSTRAINT sin_solapamiento
		     EXCLUDE USING gist (
		       alojamiento_id WITH =,
		       rango_fechas WITH &&
		     )
		     WHERE (estado <> 'cancelada');
		 EXCEPTION
		   WHEN duplicate_object THEN NULL;
		   WHEN duplicate_table THEN NULL;
		 END $$`,
	}

	for _, stmt := range statements {
		if err := gdb.Exec(stmt).Error; err != nil {
			return fmt.Errorf("migración cruda falló (%s): %w", stmt, err)
		}
	}

	return nil
}
