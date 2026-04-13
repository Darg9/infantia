# Módulo: Centro de Seguridad y Legal

**Versión:** ✅ v0.11.0-S42

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
- En cada Tarjeta de Listado (`ActivityCard.tsx`) y Página de Detalle de Actividad se incluye `ACTIVITY_DISCLAIMER_FULL` o `ACTIVITY_DISCLAIMER_SHORT`.

### 2. Tratamiento de Menores (Ley 1581)
- La información vinculada al perfil del "Niño/Acudiente" en la app carece de vinculaciones peligrosas, rigiéndose estrictamente por el Interés Superior del Niño.
- Ver documento `data-treatment.ts` donde se establece explícitamente el tratamiento excepcional, bajo tutela y custodia criptográfica.

## 💡 Reglas de Modificación
- *Nunca hardcodear* textos legales directamente en los componentes de React, UI, `Layout`, o modales.
- Si requieres cambiar la política de privacidad, módificala directamente en `privacy.ts` y compila la app. La ruta de web y el endpoint de descarga de PDF quedarán actualizados simultáneamente sin margen de error.
