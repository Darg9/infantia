# Documentación funcional — Módulos de Infantia

Cada archivo documenta un módulo: qué hace, cómo usarlo, sus tests y qué está pendiente.
Se actualiza en cada PR que toca ese módulo.

## Módulos documentados

| Módulo | Doc | Estado |
|---|---|---|
| scraping | [scraping.md](scraping.md) | ✅ v0.9.0 |
| activities | [activities.md](activities.md) | ✅ v0.9.0 |
| providers | providers.md | 🔜 pendiente |
| search | search.md | 🔜 pendiente |
| verticals | verticals.md | 🔜 pendiente |
| users | users.md | 🔜 pendiente |

## Regla

Cuando se hace un PR que modifica `src/modules/<nombre>/`:
1. Actualizar `docs/modules/<nombre>.md`
2. Actualizar la versión en el encabezado del doc
3. Marcar en el checklist del PR
