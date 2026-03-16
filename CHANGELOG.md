# Changelog — Infantia

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).
Versionamiento basado en [Semantic Versioning](https://semver.org/lang/es/).

Relación con Documento Fundacional:
- Cada tag `vX.Y.Z` en git corresponde a una versión del doc (V01, V02...).
- Cambios menores acumulan hasta el siguiente hito → nuevo doc.

---

## [Unreleased]
<!-- Agregar aquí cada cambio antes de hacer el tag de release -->

### Added
- Sistema de testing con Vitest: threshold dinámico +10%/día desde 2026-03-16
- 46 tests iniciales: ScrapingCache, activityNLPResultSchema, activity schemas
- GitHub Actions: CI corre tests en cada push/PR
- Workflow de versionamiento con feature branches, PR template, CHANGELOG y docs de módulos
- Separación completa de habit-challenge en su propio directorio y repo

### Fixed
- schema.prisma sin `url` (Prisma 7 lo toma de prisma.config.ts)
- node_modules con Prisma 5 → reinstalado Prisma 7
- Regla de directorio en CLAUDE.md para prevenir mezcla de proyectos

---

## [v0.1.0] — 2026-03-16
**Documento Fundacional: V05**

### Added
- Pipeline de scraping completo end-to-end
- Batch scraping BibloRed: 167 actividades guardadas en Supabase (97% alta confianza)
- Integración Gemini 2.5 Flash para NLP / extracción de datos
- Conexión a Supabase PostgreSQL con Prisma 7
- Seed inicial: 10 ciudades, 1 vertical (Infantia), 47 categorías
- Cache incremental de scraping (`data/scraping-cache.json`)
- Script `verify-db.ts` para validar estado de la base de datos
- API de actividades con CRUD completo
- Arquitectura modular por dominio (scraping, activities, providers, search...)
- Schema de base de datos con 11 entidades
- Scraper genérico con Cheerio + Playwright

### Decisions
- Stack: Next.js 15 + TypeScript + Supabase + Prisma 7 + Meilisearch
- NLP: Gemini 2.5 Flash (scraping) — Claude API (futuro)
- Hosting: Vercel (frontend) + Railway (workers)
- Multi-vertical por configuración, no por código
- Sin ActivityOccurrence en MVP (over-engineering)

---

## [v0.0.1] — 2026-03-15
**Documento Fundacional: V02**

### Added
- Definición de visión, problema y solución
- Modelo de datos conceptual (11 entidades)
- Arquitectura de alto nivel
- Estrategia geográfica multi-país
- Hipótesis de monetización
- Roadmap inicial
- Decisión de stack tecnológico (Scenario 1: Node.js Full-Stack)
