# Módulo: Centro de Seguridad y Legal

**Versión:** ✅ v0.22.0
**Última actualización:** 19 de mayo de 2026

Este módulo centraliza todas las normativas legales, políticas de privacidad, tratamiento de datos (Cumplimiento de la Ley 1581) y reglas de interacción del usuario bajo una arquitectura **Single Source of Truth (SSOT)**.

## 🎯 Arquitectura de Verdad Única (SSOT)

Para resolver el problema histórico de desincronización entre lo que se muestra en la web UI, lo que declaran los PDFs estáticos y lo que impone el backend, **todos los textos legales se dictan desde arrays nativos en `src/modules/legal/constants/`**.

| Archivo Fuente | Propósito | Responsabilidades Legales Cubiertas |
|---|---|---|
| `privacy.ts` | Políticas de Privacidad | Cookies, Cesión a terceros, Retención de cuenta, Derechos ARCO. |
| `terms.ts` | Términos de Servicio | Límites de Responsabilidad (Intermediario), Uso apropiado, Propiedad. |
| `data-treatment.ts` | Tratamiento Datos (Ley 1581) | Principios de privacidad, Tratamiento de datos de **menores**, Autorización. |
| `legal-disclaimers.ts` | Advertencias UI | Mensajes inyectados en la UI recordando la condición de fuente tercera. |
| `pqrs.ts` | Gestión de PQRS | Categorías legales (Acceso, Rectificación, Supresión) y Canales de respuesta. |
| `consent.ts` | Consentimiento parental (Ley 1581 menores) | `CONSENT_TEXT` — texto único exportado y consumido por `api/children/route.ts`, `onboarding/page.tsx`, `perfil/hijos/nuevo/page.tsx`. Elimina duplicación 3×. |

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

### 3. Datos de Interacción y Analytics (NUEVO v0.16.1-S44)
- **Declarado en `privacy.ts`**: "La Plataforma podrá recolectar y utilizar datos de interacción (como clics y navegación) y datos técnicos (como dirección IP, tipo de dispositivo y navegador) con fines de mejorar la relevancia del contenido, analizar el uso del servicio, y prevenir abusos o usos indebidos. Esta información se utiliza de forma agregada y **no para identificación personal directa**."
- Esto cubre explícitamente el CTR Feedback Loop (S44): clics → ranking → crawler.
- IP y User-Agent se almacenan en tabla `Event` (`ip VARCHAR(50)`, `userAgent TEXT`) — declarados en privacidad y tratamiento de datos.

### 4. Scraping y Data Pipeline V1 (Protección Preventiva)
- En la etapa de Ingesta de Datos, el **Data Pipeline Core** opera bajo un principio preventivo legal: descarta proactivamente la información basura que pueda exponer al sistema como un recolector de texto no deseado (Spam).
- Esto se refuerza mediante un Umbral Diferenciado: si una actividad fue ingestada sin IA (Fallback Cheerio), se le exige **confianza superior (0.5 vs 0.3)** y una re-evaluación prioritaria posterior (Scheduler Inteligente).
- Esto garantiza que solo la metadata validada (ejemplo: categorización mediante 10 buckets estrictos y evaluación del SourceHealth) sea almacenada limpiamente en la Base de Datos PostgreSQL, cuidando los Principios de Calidad del Tratamiento de Datos.

### 5. Gestión de PQRS y SLAs (Ley 1581) [ACTUALIZADO v0.17.0]
Para cumplir rigurosamente con los artículos 14 y 15 de la Ley 1581, Infantia implementa un sistema de monitoreo de SLAs (Service Level Agreements) basado en días hábiles:

- **Tiempos de Respuesta Estrictos**:
    - **Respuesta Inicial**: Máximo **3 días hábiles** para confirmar recepción y primer contacto.
    - **Resolución de Consultas**: Máximo **10 días hábiles**.
    - **Resolución de Reclamos**: Máximo **15 días hábiles**.
- **Trazabilidad Forense**: La tabla `ContactRequest` registra no solo el mensaje, sino:
    - `firstRespondedAt`: Marca de tiempo del primer contacto humano.
    - `resolvedAt` / `resolvedBy`: Quién y cuándo cerró el caso.
    - `responseChannel`: Medio usado (Email, WhatsApp, etc.).
- **Alertas Automatizadas (Cron)**: Un proceso de backend (`/api/admin/check-overdue-pqrs`) audita diariamente las peticiones pendientes y notifica a `info@habitaplan.com` si algún caso está por vencer o vencido.

### 6. Versionamiento de Consentimiento Granular [NUEVO v0.17.0]
Ya no basta con saber *que* un usuario aceptó, sino *qué versión* aceptó. El modelo `User` incluye:
- `termsVersion`: Versión específica de los Términos de Servicio.
- `privacyVersion`: Versión específica de la Política de Privacidad.
- `privacyAcceptedAt`: Timestamp de la última actualización de consentimiento.
Esto permite forzar una re-aceptación si las políticas cambian sustancialmente (Compliance Audit Ready).

### 6. Coherencia UI ↔ PDF ↔ SSOT (estado actual)

| Documento | Versión | Última actualización |
|---|---|---|
| Política de Privacidad | v1.0 | 24 de abril de 2026 |
| Términos y Condiciones | v1.0 | 24 de abril de 2026 |
| Tratamiento de Datos | v1.0 | 24 de abril de 2026 |

Las tres rutas web (`/seguridad/privacidad`, `/seguridad/terminos`, `/seguridad/datos`) y sus PDF descargables consumen los mismos arrays TypeScript. **Imposible desincronización.**

## 🔑 Cumplimiento Legal SSO y Consentimiento Explícito (v0.16.1)

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
| `GET /centro-de-confianza` | Web SSR | Hub central de confianza y legalidad (SSOT) |
| `GET /centro-de-confianza/privacidad` | Web SSR | Política de Privacidad renderizada |
| `GET /centro-de-confianza/terminos` | Web SSR | Términos y Condiciones |
| `GET /centro-de-confianza/datos` | Web SSR | Tratamiento de Datos (Ley 1581) |
| `GET /seguridad/privacidad` | Redirect 301 | → `/centro-de-confianza/privacidad` |
| `GET /seguridad/terminos` | Redirect 301 | → `/centro-de-confianza/terminos` |
| `GET /privacidad` | Redirect 301 | → `/centro-de-confianza/privacidad` |
| `GET /terminos` | Redirect 301 | → `/centro-de-confianza/terminos` |
| `GET /api/legal/privacidad/pdf` | API | Descarga PDF Privacidad |
| `GET /api/legal/terminos/pdf` | API | Descarga PDF Términos |
| `GET /api/legal/datos/pdf` | API | Descarga PDF Tratamiento Datos |

> **SSOT (S72):** `/centro-de-confianza` es el hub único de confianza editorial, legal y de seguridad. Cualquier enlace desde UI, email o sitemap debe apuntar aquí. Las rutas legacy (`/privacidad`, `/terminos`, `/seguridad/*`) redirigen con 301 permanente.

## 💡 Reglas de Modificación
- **Un solo namespace:** Todas las rutas legales viven bajo `/centro-de-confianza/*`. No duplicar rutas legales.
- **Redirecciones:** Las rutas legacy redirigen vía 301 (permanent) en `next.config.ts`.
- *Nunca hardcodear* textos legales directamente en los componentes de React, UI, `Layout`, o modales.
- Para cambiar cualquier texto legal: modificar el archivo `.ts` correspondiente en `src/modules/legal/constants/` → compila la app → web y PDF se actualizan simultáneamente.
- Cambios en datos recolectados → actualizar `privacy.ts` **y** `data-treatment.ts` para mantener coherencia.

## 🎨 Identidad Visual y Branding (v0.16.1)
Los assets de marca (logo, og.png, favicon) están completamente desacoplados del sistema legal. Los textos de disclaimer se mantienen en `src/modules/legal/constants/legal-disclaimers.ts` y son consumidos por `ActivityCard.tsx` y las páginas de detalle. El pipeline de branding (`scripts/generate-brand-assets.mjs`) no afecta ni altera los textos legales. **SSOT legal preservado.**
