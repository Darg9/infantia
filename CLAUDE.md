# Infantia - Project Guidelines

## ⚠️ REGLA DE SEGURIDAD — VERIFICACIÓN DE DIRECTORIO

**AL INICIO DE CADA SESIÓN, antes de escribir cualquier línea de código:**

1. Ejecuta `pwd` y verifica que el resultado sea `C:/Users/denys/Projects/infantia`
2. Si el directorio NO es ese, detente inmediatamente y avisa al usuario:
   > "⛔ Directorio incorrecto: estoy en [directorio actual]. Este proyecto debe abrirse desde C:/Users/denys/Projects/infantia. Abre Claude Code desde esa carpeta."
3. Verifica que `prisma/schema.prisma` exista y contenga `provider = "postgresql"` (no SQLite).
   Si contiene SQLite o le falta `provider`, detente y avisa antes de continuar.

**Este proyecto es INFANTIA. Nunca escribas código de habit-challenge aquí.**
**habit-challenge tiene su propio directorio: `C:/Users/denys/Projects/habit-challenge`**

## What is this project?
Infantia is a multi-source activity discovery platform for families. It aggregates activities from websites, social media, and messaging platforms into a single searchable interface.

## Tech Stack
- **Framework:** Next.js 15 (App Router) + TypeScript
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL via Supabase
- **ORM:** Prisma
- **Search:** Meilisearch
- **Auth:** Supabase Auth
- **Scraping:** Playwright + Cheerio
- **AI/NLP:** Claude API (Anthropic)
- **Queue:** BullMQ + Redis

## Project Structure
```
src/
  app/           → Next.js App Router (pages, layouts, API routes)
  modules/       → Domain modules (activities, providers, scraping, etc.)
  components/    → Reusable UI components
  lib/           → Shared utilities
  types/         → TypeScript type definitions
  config/        → App configuration and constants
  hooks/         → Custom React hooks
```

## Conventions
- Use TypeScript strict mode
- Module-based organization: each domain has its own folder under `src/modules/`
- API routes go in `src/app/api/`
- Use Prisma for all database access
- All dates stored in UTC, displayed in local timezone
- Spanish for user-facing content, English for code (variable names, comments)
- No hardcoded cities, countries, or currencies — always dynamic from database

## Commands
- `npm run dev` — Start development server
- `npm run build` — Build for production
- `npm run lint` — Run ESLint
- `npm test` — Correr tests (una vez)
- `npm run test:watch` — Correr tests en modo watch
- `npm run test:coverage` — Tests + reporte de cobertura con threshold dinámico

## ⚠️ REGLA DE TESTING OBLIGATORIA

**Cada vez que modifiques o crees código en `src/modules/` o `src/lib/`:**

1. Verifica si existe un archivo de test en `__tests__/` junto al módulo
2. Si no existe → créalo con tests básicos del nuevo código
3. Si existe → agrégale tests para la funcionalidad nueva/modificada
4. Corre `npm test` antes de hacer commit — si falla, no hagas commit

**Threshold de cobertura:** sube +10% por día desde el inicio del proyecto (2026-03-16).
El CI rechazará PRs que bajen la cobertura por debajo del threshold del día.

## Workflow de versionamiento

**Cada unidad de trabajo = una rama + código + tests + docs. Nada llega a master sin los tres.**

### Flujo por tarea

```
1. Crear rama:   git checkout -b feat/nombre-descriptivo
2. Escribir código
3. Escribir/actualizar tests → npm test debe pasar
4. Actualizar docs/modules/<módulo>.md
5. Agregar entrada en CHANGELOG.md bajo [Unreleased]
6. Commit y merge a master
7. Si es hito → tag vX.Y.Z + nuevo Documento Fundacional (V0X.docx)
```

### Convención de ramas

| Prefijo | Cuándo usarlo |
|---|---|
| `feat/` | Nueva funcionalidad (scraper nuevo, endpoint nuevo) |
| `fix/` | Corrección de bug |
| `chore/` | Infraestructura, dependencias, limpieza |
| `test/` | Solo agregar/mejorar tests |
| `docs/` | Solo documentación |

### Versiones (Semantic Versioning)

| Versión | Cuándo |
|---|---|
| `vX.Y.Z` patch | Fix sin cambio funcional |
| `vX.Y.Z` minor | Nueva funcionalidad compatible |
| `vX.Y.Z` major | Cambio arquitectural o breaking change |

### Relación git tag ↔ Documento Fundacional

| Git tag | Doc Fundacional | Descripción |
|---|---|---|
| v0.0.1 | V02 | Stack, arquitectura, modelo de datos |
| v0.1.0 | V05 | Pipeline scraping completo, 167 actividades BibloRed |
| v0.2.0 | V06 (próximo) | API pública + segundo scraper |

### Regla para Documento Fundacional

Generar nueva versión del doc cuando:
- Se agrega un módulo nuevo completo
- Cambia la arquitectura o el stack
- Se completa un milestone del roadmap

Comando: `node scripts/generate_v05.mjs` (actualizar número de versión primero)

## Agent Orchestration (Claude Code + Gemini)
**CRITICAL RULE FOR CLAUDE CODE:** The user has limited Claude Pro credits. Claude Code must act as a lightweight, fast executer, and offload all heavy-lifting to Gemini (Antigravity).
- **Claude Code's Job:** Run terminal commands, generate boilerplate, fix small typos, run ESLint/TS errors, and answer quick context questions.
- **Gemini's Job (Antigravity):** Architect complex features (like the Scraping engine), write massive refactors, create extensive documentation, and debug deep logical issues.
- If a task requires writing more than 100 lines of code or complex reasoning, Claude Code MUST advise the user to switch to Gemini.
- Always use `/compact` in Claude Code after finishing a distinct sub-task to save context tokens.
