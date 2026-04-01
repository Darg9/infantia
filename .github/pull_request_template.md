## ¿Qué hace este cambio?
<!-- Una línea clara. Ej: "Agrega scraper para Idartes con soporte de paginación" -->


## Tipo de cambio
- [ ] `feat` — nueva funcionalidad
- [ ] `fix` — corrección de bug
- [ ] `chore` — infraestructura / limpieza
- [ ] `test` — solo tests
- [ ] `docs` — solo documentación

---

## Checklist obligatorio

### Código
- [ ] El código compila sin errores TypeScript
- [ ] `npm run lint` pasa sin errores
- [ ] No hay `console.*` — usar `createLogger(ctx)` de `src/lib/logger.ts`
- [ ] No hay credenciales ni secrets hardcodeados

### Tests
- [ ] `npm test` pasa al 100%
- [ ] Se agregaron/actualizaron tests para el código nuevo o modificado
- [ ] La cobertura no bajó del threshold del día (`npm run test:coverage`)

### Documentación funcional
- [ ] Se actualizó `docs/modules/<módulo>.md` si se modificó ese módulo
- [ ] Se agregó entrada en `CHANGELOG.md` bajo `[Unreleased]`
- [ ] Si es un hito mayor → se creó nueva versión del Documento Fundacional (V0X.docx)

---

## Módulos afectados
<!-- Lista los módulos tocados: scraping, activities, providers, search, etc. -->


## ¿Rompe algo existente?
- [ ] No
- [ ] Sí → explicar:
