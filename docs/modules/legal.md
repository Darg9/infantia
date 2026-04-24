# Módulo: Centro de Seguridad y Legal

**Versión:** ✅ v0.16.0
**Última actualización:** 24 de abril de 2026

Este módulo centraliza todas las normativas legales, políticas de privacidad, tratamiento de datos (Cumplimiento de la Ley 1581) y reglas de interacción del usuario bajo una arquitectura **Single Source of Truth (SSOT)**.

## 🎯 Arquitectura de Verdad Única (SSOT)

Para resolver el problema histórico de desincronización entre lo que se muestra en la web UI, lo que declaran los PDFs estáticos y lo que impone el backend, **todos los textos legales se dictan desde arrays nativos en `src/modules/legal/constants/`**.

| Archivo Fuente | Propósito | Responsabilidades Legales Cubiertas |
|---|---|---|
| `privacy.ts` | Políticas de Privacidad | Cookies, Cesión a terceros, Retención de cuenta, Derechos ARCO. |
| `terms.ts` | Términos de Servicio | Límites de Responsabilidad (Intermediario), Uso apropiado, Propiedad. |
| `data-treatment.ts` | Tratamiento Datos (Ley 1581) | Principios de privacidad, Tratamiento de datos de **menores**, Autorización. |
| `legal-disclaimers.ts` | Advertencias UI | Mensajes inyectados en la UI recordando la condición de fuente tercera. |

### Flujos UI (`/seguridad/*`) vs Generación PDF (`react-pdf`)

Las páginas web iteran los mismos arrays `dataTreatmentSections`, `termsSections` y `privacySections` que los sistemas de compilación PDF:

1. **Ruta Web (`src/app/seguridad/privacidad/page.tsx`)**: Lee `privacySections` y renderiza el texto formateado optimizado para lectura digital (incorporando "Resúmenes Explicativos").
2. **Generador PDF (`src/app/api/legal/privacidad/pdf/route.ts`)**: Invoca el componente `<PrivacidadPDF />` que _react-pdf_ procesa y envía un blob binario asegurando que el contenido al nivel del byte sea idéntico al de la Web UI y persistente para firmas y requerimientos legales.

## ⚖️ Aspectos Legales Críticos Tratados

### 1. Actuación Exclusiva como Intermediarios Tecnológicos
- **Validado en `terms.ts`**: HabitaPlan opera como un recopilador indexado y agregador, **no es responsable** de la calidad, salud ni riesgos físicos asociados a los eventos (campamentos, talleres) proporcionados por terceros.
- En cada Tarjeta de Listado (`ActivityCard.tsx`) y Página de Detalle de Actividad se incluye `ACTIVITY_DISCLAIMER_FULL` o `ACTIVITY_DISCLAIMER_SHORT` desde `legal-disclaimers.ts`.

**Textos activos (SSOT):**
```
ACTIVITY_DISCLAIMER_FULL: "La información presentada puede provenir de entidades públicas,
organizaciones privadas o proveedores externos y tiene fines exclusivamente informativos.
HabitaPlan no garantiza su exactitud, disponibilidad o vigencia..."

ACTIVITY_DISCLAIMER_SHORT: "La información puede provenir de terceros y estar sujeta a cambios."
```

### 2. Tratamiento de Menores (Ley 1581)
- La información vinculada al perfil del "Niño/Acudiente" en la app carece de vinculaciones peligrosas, rigiéndose estrictamente por el Interés Superior del Niño.
- Ver `data-treatment.ts` — sección "Menores": autorización parental previa requerida, datos sin vínculo directo riesgoso.

### 3. Datos de Interacción y Analytics (NUEVO v0.11.0-S44)
- **Declarado en `privacy.ts`**: "La Plataforma podrá recolectar y utilizar datos de interacción (como clics y navegación) y datos técnicos (como dirección IP, tipo de dispositivo y navegador) con fines de mejorar la relevancia del contenido, analizar el uso del servicio, y prevenir abusos o usos indebidos. Esta información se utiliza de forma agregada y **no para identificación personal directa**."
- Esto cubre explícitamente el CTR Feedback Loop (S44): clics → ranking → crawler.
- IP y User-Agent se almacenan en tabla `Event` (`ip VARCHAR(50)`, `userAgent TEXT`) — declarados en privacidad y tratamiento de datos.

### 4. Scraping y Data Pipeline V1 (Protección Preventiva)
- En la etapa de Ingesta de Datos, el **Data Pipeline Core** opera bajo un principio preventivo legal: descarta proactivamente la información basura que pueda exponer al sistema como un recolector de texto no deseado (Spam).
- Esto se refuerza mediante un Umbral Diferenciado: si una actividad fue ingestada sin IA (Fallback Cheerio), se le exige **confianza superior (0.5 vs 0.3)** y una re-evaluación prioritaria posterior (Scheduler Inteligente).
- Esto garantiza que solo la metadata validada (ejemplo: categorización mediante 10 buckets estrictos y evaluación del SourceHealth) sea almacenada limpiamente en la Base de Datos PostgreSQL, cuidando los Principios de Calidad del Tratamiento de Datos.

### 5. Auditoría SIC en Peticiones de Contacto (NUEVO v0.16.1)
- Para cumplir rigurosamente con los artículos 14 y 15 de la Ley 1581 (tiempos de respuesta de 10 y 15 días hábiles), el formulario de contacto clasifica las solicitudes obligatoriamente en tipos de derechos (Acceso, Rectificación, etc.).
- Toda solicitud de contacto se guarda primero en la tabla `ContactRequest` en Base de Datos capturando IP y User Agent **antes** de despachar cualquier correo electrónico, garantizando trazabilidad y registro forense de recepción aún frente a fallos del proveedor de correo.
- Se lleva un registro estricto del estado de envío del correo (`emailStatus: 'sent' | 'failed'`).

### 6. Coherencia UI ↔ PDF ↔ SSOT (estado actual)

| Documento | Versión | Última actualización |
|---|---|---|
| Política de Privacidad | v1.0 | 11 de abril de 2026 |
| Términos y Condiciones | v1.0 | 11 de abril de 2026 |
| Tratamiento de Datos | v1.0 | 11 de abril de 2026 |

Las tres rutas web (`/seguridad/privacidad`, `/seguridad/terminos`, `/seguridad/datos`) y sus PDF descargables consumen los mismos arrays TypeScript. **Imposible desincronización.**

## 🔑 Cumplimiento Legal SSO y Consentimiento Explícito (v0.16.0)

Con la integración de SSO (Google, Magic Link), se introdujeron mecanismos adicionales de cumplimiento legal:

### `termsAcceptedAt` — Registro Auditable
- Todos los usuarios (SSO, Magic Link, Email, OTP) deben aceptar los Términos de Uso antes de acceder.
- La aceptación se registra en `public.users.termsAcceptedAt` (timestamp UTC).
- El callback centralizado (`/auth/callback`) bloquea el acceso y redirige a `/auth/terminos` si `termsAcceptedAt === null`.
- La aceptación se persiste exclusivamente desde una **Server Action** (nunca desde el cliente).

### Flujo de Consentimiento
```
Nuevo usuario (cualquier proveedor)
  → /auth/callback detecta termsAcceptedAt === null
  → /auth/terminos?next=<ruta original>
  → Usuario lee y acepta explícitamente (checkbox NO pre-marcado)
  → Server Action actualiza termsAcceptedAt
  → Redirect a ruta original
```

### Checkbox de Registro (RGPD / Ley 1581)
- El formulario de registro por email incluye checkbox explícito NO pre-marcado.
- Enlaza a `/seguridad/datos` (Política de Tratamiento) y `/terminos` (Términos de Uso).
- El botón "Crear cuenta" permanece deshabilitado hasta aceptación.

## Rutas del sistema legal

| Ruta | Tipo | Descripción |
|---|---|---|
| `GET /seguridad/privacidad` | Web SSR | Política de Privacidad renderizada |
| `GET /seguridad/terminos` | Web SSR | Términos y Condiciones |
| `GET /seguridad/datos` | Web SSR | Tratamiento de Datos (Ley 1581) |
| `GET /api/legal/privacidad/pdf` | API | Descarga PDF Privacidad |
| `GET /api/legal/terminos/pdf` | API | Descarga PDF Términos |
| `GET /api/legal/datos/pdf` | API | Descarga PDF Tratamiento Datos |

## 💡 Reglas de Modificación
- **Un solo namespace:** Todas las rutas legales deben vivir estrictamente bajo `/seguridad/*`. No duplicar rutas legales.
- **Redirecciones:** Las rutas legacy deben redirigir vía 308 (permanent) en `next.config.ts`.
- *Nunca hardcodear* textos legales directamente en los componentes de React, UI, `Layout`, o modales.
- Para cambiar cualquier texto legal: modificar el archivo `.ts` correspondiente en `src/modules/legal/constants/` → compila la app → web y PDF se actualizan simultáneamente.
- Cambios en datos recolectados → actualizar `privacy.ts` **y** `data-treatment.ts` para mantener coherencia.

## 🎨 Identidad Visual y Branding (v0.13.2)
Los assets de marca (logo, og.png, favicon) están completamente desacoplados del sistema legal. Los textos de disclaimer se mantienen en `src/modules/legal/constants/legal-disclaimers.ts` y son consumidos por `ActivityCard.tsx` y las páginas de detalle. El pipeline de branding (`scripts/generate-brand-assets.mjs`) no afecta ni altera los textos legales. **SSOT legal preservado.**
