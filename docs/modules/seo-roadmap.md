# Estrategia SEO de Abundancia (V3)
**Versión:** v0.20.0
**Última actualización:** 10 de Mayo de 2026

Este documento traza la hoja de ruta estratégica para gobernar el volumen masivo de datos introducido por el Pipeline V3, evitando que la abundancia degrade la calidad técnica y semántica del SEO de HabitaPlan.

## 1. Pendientes SEO Críticos (Próximos)

Estos elementos son inevitables para soportar la carga estructural de V3 sin que Google penalice la plataforma.

1. **Sitemap Partitioning (Prevención de colapso serverless):**
   - El mapeo dinámico único (`activities.map`) agotará memoria.
   - *Acción:* Particionar nativamente en Next.js por ciudad o bloques (ej. `/sitemaps/bogota.xml`, `/sitemaps/events-1.xml`).
2. **Estrategia Real de Expirados:**
   - *Activo:* `index, follow`
   - *Expirado Reciente:* Mantener indexado (retiene tráfico/backlinks, ofrece navegación alternativa).
   - *Expirado Viejo:* `noindex, follow` (limpia el crawl budget).
   - *Evergreen Útil:* Mantener vivo.
3. **Tiers de Indexación (Indexability Tiers):**
   - Con *preservation-first*, sobreviven eventos con metadata pobre.
   - *Acción:* Desacoplar persistencia de indexación. Metadata rica = `index`. Metadata pobre o duplicado = `noindex` o `canonical`.
4. **Semantic Dedupe SEO (Anti-Canibalización):**
   - Múltiples fuentes publicando el mismo evento (Idartes, BibloRed) generan 4 URLs compitiendo.
   - *Acción:* Estructura de **Master Activity** con Source Aliases, apuntando a una única URL Canónica principal.
5. **Canonical Strategy Avanzada:**
   - La etiqueta Canonical debe volverse dinámica para sobrevivir a *merges*, deduplicaciones, aliases y cambios de título a lo largo del tiempo.

## 2. Pendientes SEO Importantes (Mediano Plazo)

1. **Landing Pages Hiperlocales:**
   - Aprovechar el long-tail móvil (ej. `/bogota/chapinero/talleres-ninos`). Requiere estabilidad previa del catálogo masivo.
2. **Query Intent Optimization:**
   - Diferenciar layouts y schema según la intención:
     - *Discovery:* "Qué hacer hoy"
     - *Transactional:* Obra específica.
     - *Hyperlocal:* "Cerca de mí"
3. **Internal Linking Dinámico:**
   - Pasar de enlaces estáticos a sugerencias basadas en popularidad, similitud vectorial, intención y comportamiento de usuario.
4. **Divergencia Feed vs. Index:**
   - Aceptar que lo mejor para SEO no siempre es lo mejor para el Feed (ej. un evento nicho muy buscado orgánicamente, pero demasiado específico para la portada de la App).

## 3. Pendientes SEO Avanzados (Futuro)

1. **Entity Graph Cultural ("Moat" Competitivo):**
   - Convertir Venues, Organizadores, Eventos y Barrios en "Entidades SEO navegables".
   - Esto cambia a HabitaPlan de ser un listado, a ser la "Wikipedia estructurada" de la cultura infantil.
2. **Programmatic SEO Controlado:**
   - Generación masiva de combinaciones (Ciudad + Categoría + Precio + Edad). 
   - *Riesgo:* Destrucción de calidad si se hace sin control.
3. **Search Console Observability en Tiempo Real:**
   - Monitoreo integrado de anomalies de CTR, *Keyword Cannibalization*, páginas ignoradas y *Thin Content* detectado por Google.

---
**Conclusión:** El SEO de HabitaPlan ya no es un problema de infraestructura básica (JSON-LD, Meta tags), sino un problema algorítmico y editorial. El verdadero SEO ahora es gobernar la abundancia.
