# Documentación funcional — Módulos de HabitaPlan

Cada archivo documenta un módulo: qué hace, cómo usarlo, sus tests y qué está pendiente.
Se actualiza en cada PR que toca ese módulo.

## Módulos documentados

| Módulo | Doc | Estado |
|---|---|---|
| auth | [auth.md](auth.md) | ✅ v0.18.0-stable |
| scraping | [scraping.md](scraping.md) | ✅ v0.18.0-stable |
| activities | [activities.md](activities.md) | ✅ v0.18.0-stable |
| product / ux | [product.md](product.md) | ✅ v0.18.0-stable |
| analytics | [analytics.md](analytics.md) | ✅ v0.18.0-stable |
| legal | [legal.md](legal.md) | ✅ v0.18.0-stable |
| design-system | [design-system.md](design-system.md) | ✅ v0.18.0-stable |
| providers | providers.md | 🔜 pendiente |
| search | search.md | *Ref. en product.md* |
| verticals | verticals.md | 🔜 pendiente |
| users | users.md | 🔜 pendiente |

## Regla

Cuando se hace un PR que modifica `src/modules/<nombre>/`:
1. Actualizar `docs/modules/<nombre>.md`
2. Actualizar la versión en el encabezado del doc
3. Marcar en el checklist del PR
