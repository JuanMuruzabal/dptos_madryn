# Turismo Marcuzzi — Brief de Diseño Frontend

> Descripción del lenguaje visual deseado, inspirado en la estructura y las interacciones del sitio de Bungie (Destiny 2), adaptado a un sitio de turismo cálido en Puerto Madryn. Pensado para pasarle directamente a Claude Code como referencia de implementación.

---

## Concepto general

Un sitio **cinematográfico, inmersivo y con mucho aire**, donde las **fotos son las protagonistas** y ocupan el ancho completo de la pantalla. La estructura y las interacciones son las del sitio de Bungie, pero el tono es **cálido y acogedor** (Patagonia / mar), no oscuro/gamer.

Principios:
- Imágenes a sangre completa (full-bleed), grandes y luminosas.
- Mucho espacio en blanco entre secciones (respira, no se amontona).
- Contenido centrado en un contenedor con ancho máximo y márgenes amplios en desktop.
- Tipografía en mayúsculas con espaciado (letter-spacing) para títulos y navegación.
- Transiciones suaves en todo: crossfades, hover, aparición al hacer scroll.
- Mobile-first y totalmente responsive.

---

## Paleta de color — elegir UNA variante

**Bungie es oscuro; nuestro sitio quiere ser cálido. Dos caminos:**

### Variante A — Clara / cálida (recomendada para "acogedor")
- Fondo general: blanco roto / arena muy clara (`#F7F4EF`).
- Texto principal: azul petróleo profundo casi negro (`#12333B`).
- Acento cálido (botones rellenos, CTAs): coral/terracota (`#E2725B`) o dorado arena (`#C99A5B`).
- Secundario: turquesa mar (`#1F7A8C`).
- Las secciones de foto siguen teniendo overlay oscuro para legibilidad del texto encima.

### Variante B — Oscura / cinematográfica (más fiel a Bungie)
- Fondo general: azul noche muy oscuro (`#0C1B22`).
- Texto principal: blanco roto (`#F2EFEA`).
- Acento: dorado arena (`#C99A5B`) o coral (`#E2725B`).
- Secundario: turquesa (`#2CA6A4`).

> En ambas variantes se mantiene la **misma estructura, tipografía y animaciones** descritas abajo. Solo cambian los colores de fondo y texto.

---

## Tipografía

- **Títulos / hero:** una tipografía display con carácter. Ej: una serif elegante o una sans geométrica con peso.
- **Cuerpo:** una sans legible y neutra.
- **Navegación y etiquetas:** mayúsculas, tamaño chico, letter-spacing marcado.

**Elección concreta (agregado 2026-08-11, ver TR-012 en `docs/tradeoffs.md`):** Vidaloka (display, carácter de afiche de viaje vintage, un solo peso, uso moderado) + IBM Plex Sans (cuerpo) + IBM Plex Mono (etiquetas/nav/eyebrows — registro de bitácora/carta náutica). Solo el `<h1>` del hero va en mayúsculas trackeadas; el resto de los títulos van en caja normal para no repetir el tic de "todo en mayúsculas" de cualquier landing genérica. Firma tipográfica: las coordenadas reales de Puerto Madryn (`42°46′S 65°02′O`) en mono, en el hero y el footer.

---

## Estructura de la página principal (Home)

### 1. Header (barra de navegación)
- **Fijo (sticky) arriba.**
- **Transparente cuando está sobre el hero**, y **pasa a fondo sólido al scrollear** hacia abajo (transición suave de fondo y sombra).
- Izquierda: **logo "Turismo Marcuzzi"**.
- Centro/izquierda: links en mayúsculas → `ALOJAMIENTO` · `EXPERIENCIAS` · `SERVICIO TURÍSTICO` · `TRASLADOS` · `CONTACTO` (Servicio Turístico agregado 2026-08-11).
- Derecha: ícono de **búsqueda**, selector de **idioma** (si va ES/EN), y botón **"Ingresar"**.

### 2. Hero a pantalla completa
- Alto: ~80% de la altura de la pantalla (`80vh`).
- **Fondo con imagen (o video) de Puerto Madryn a sangre completa**, con **degradado oscuro** encima para que el texto se lea.
- **El fondo rota entre varias fotos con transición crossfade suave** (mar, ballenas, departamento, atardecer patagónico) — igual que el hero de Bungie va cambiando de escena.
- Encima, alineado a la izquierda o al centro:
  - Título grande: **"TURISMO MARCUZZI"**.
  - Subtítulo / descripción que enfatiza el **servicio personalizado** (el diferenciador vs. Airbnb).
  - Dos botones: uno **relleno con color de acento** ("Ver alojamientos") y uno **con contorno / fantasma** ("Conocer más").

### 3. Las cuatro categorías (sección "featured")
Reemplaza al bloque "FEATURED" de Bungie. Misma idea de **tarjetas de imagen protagonista con texto superpuesto**.
- Pequeña **etiqueta en mayúsculas** arriba ("NUESTROS SERVICIOS").
- **Cuatro tarjetas** (grilla asimétrica: Alojamiento grande, las otras tres apiladas — implementado en `featured-categories.tsx`), cada una con:
  - Foto de fondo a sangre completa.
  - **Etiqueta chica + título grande superpuestos abajo a la izquierda.**
  - Descripción breve.
  - **Alojamiento** — *"Encontrá el mejor lugar para tu familia."*
  - **Experiencias** — *"Organizá tu cronograma con diferentes actividades."*
  - **Servicio Turístico** *(agregado 2026-08-11)* — *"Excursiones a medida para descubrir Puerto Madryn a fondo."*
  - **Traslados** — *"No te preocupes por tu movilidad, nosotros te llevamos."*
- **Hover:** la imagen hace un leve zoom/scale y se aclara/oscurece suavemente.

### 4. Sección de destacados / novedades (opcional, estilo "LATEST")
- Etiqueta "DESTACADOS".
- Lista de ítems: **miniatura a la izquierda, título + texto corto a la derecha** (ej: departamentos destacados o experiencias de temporada).
- Botón centrado de acento: **"Ver todo"**.

### 5. Footer
- **Logo grande centrado** de Turismo Marcuzzi.
- Línea divisoria fina.
- **Varias columnas de links** (Alojamiento, Experiencias, Servicio Turístico, Traslados, Contacto, Redes).
- Datos de contacto y redes sociales.

---

## Comportamiento y animaciones (clave para el "feel" Bungie)

- **Crossfade automático** entre las imágenes de fondo del hero.
- **Header que cambia de transparente a sólido** según el scroll.
- **Aparición al scrollear (scroll reveal):** las secciones aparecen con un fade-in + leve desplazamiento hacia arriba cuando entran en pantalla.
- **Hover en tarjetas:** scale suave de la imagen (`transform: scale`) + cambio de brillo, con transición de ~300ms.
- **Parallax sutil** en las imágenes de fondo grandes (opcional).
- Todas las transiciones con easing suave (ease-in-out), nada brusco.

---

## Stack sugerido para lograr esto

- **Next.js + React + TypeScript**
- **Tailwind CSS** para el estilado.
- **Framer Motion** para las animaciones (crossfade del hero, scroll reveal, hover).
- Imágenes optimizadas con `next/image` (lazy load, WebP/AVIF).

---

## Prompt corto listo para Claude Code

> "Quiero una landing en Next.js + Tailwind + Framer Motion con estética cinematográfica e inmersiva, inspirada en la estructura del sitio de Bungie/Destiny 2 pero con paleta cálida patagónica (arena, turquesa mar, coral de acento). Header sticky que es transparente sobre el hero y se vuelve sólido al scrollear. Hero a pantalla completa (`80vh`) con imagen de fondo a sangre completa, overlay oscuro, título grande en mayúsculas, subtítulo y dos botones (uno relleno de acento, uno con contorno); el fondo del hero rota entre varias fotos con crossfade automático. Debajo, tres tarjetas grandes de imagen con etiqueta y título superpuestos abajo a la izquierda (Alojamiento, Experiencias, Traslados), con hover que hace zoom suave. Mucho espacio entre secciones, scroll reveal con fade-in, y footer con logo centrado y columnas de links. Mobile-first."

---

*Elegir entre Variante A (clara/cálida) y Variante B (oscura/cinematográfica) antes de empezar a implementar.*
