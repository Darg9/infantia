# Módulo: Producto y Experiencia de Usuario (UX)

**Versión:** ✅ v0.13.2
**Última actualización:** 22 de abril de 2026

Este documento traza los lineamientos funcionales y lógicos que dictan la experiencia de navegación para los cuidadores y publicadores dentro de HabitaPlan.

## 🧭 Flujos de Usuario Principales

1. **Onboarding Contextual** (`/onboarding`): Sistema rápido de 3 pasos (Ubicación -> Dependientes/Niños -> Configuración Base). Define la visualización del contenido.
2. **Hero Search** (Búsqueda Principal): Un ecosistema compuesto capaz de devolver predicciones mixtas. Enlaza con el listado `/actividades`.
3. **Listado de Actividades y Filtros**: Experiencia de filtros facetados en tiempo real. 
   - **Desktop (`>= md`)**: Filtros persistentes (sidebar o topbar). Actualización en tiempo real (sin CTA explícito).
   - **Mobile (`< md`)**: Filtros en Drawer / Bottom Sheet. Requiere acción explícita: "Aplicar filtros". El estado no debe mutar hasta confirmar (evita cambios inesperados).
4. **Detalle de la Actividad**: Resumen unificado por la IA de NLP, protegiendo sobre cargas cognitivas o fotos gigantes cuando el texto es la metadata esencial. Enlaza siempre hacia la ruta saliente `outbound_click`.
5. **Ecosistema de Favoritos Mixtos**: Sistema híbrido (Actividades + Lugares) estructurado por la base de datos de manera tipo-segura (XOR foreign keys). Agrupa el inventario en una única vista unificada (`/perfil/favoritos`) con tarjetas visuales polimórficas (identificación visual Actividad/Lugar) sin incurrir en deudas de integridad.

## 🔍 Punto de Entrada Principal (Search-First UX)

- La plataforma está centrada en búsqueda.
- El componente `<HeroSearch />` es el entry point dominante.
- Todo flujo de discovery debe derivar de una intención de búsqueda o exploración.

## 🔍 Motor de Búsqueda y Filtros (`HeroSearch` & `Filters`)

El buscador está diseñado para proveer una sugerencia fluida de resultados.
- **Honest but Invisible Facets:** Los filtros UI de exclusión absoluta (como "Precio nulo") son tratados sin sesgo y no rellenan sus huecos con asunciones matemáticas para evitar sumas erróneas (Falsa expectativa Gestalt en los usuarios). Si un campo tiene datos desconocidos, la interfaz de filtro se colapsa a componentes genéricos (`<select>`) evitando botones que sugieran que cubren matemáticamente el 100% de la oferta.
- **Mix de Resultados**: Muestra hasta 5 entidades agrupadas (3 Actividades, 1 Categoría, 1 Ciudad). Esto evita que una categoría inunde y tape resultados directos.
- **Búsqueda Avanzada Híbrida (`Search Engine V1`)**: Combina la flexibilidad de `pg_trgm` (tolerancia a errores ortográficos e inversión de sílabas; umbrales: `similarity(title) > 0.25`, `word_similarity(title) > 0.30`, `similarity(desc) > 0.15`; score ponderado 0.7/0.3 + prefix boost +0.10) con una normalización estricta mediante TypeScript. Esta estrategia previene el quiebre de base de datos causado por wildcards masivos `%` y pondera los puntajes antes de regresar los resultados.
- **Normalización de Queries**: Tokeniza la entrada del usuario omitiendo "stopwords", colapsando espacios y reduciendo a la raíz semántica para una mejor correlación.
- **LRU Cache & History**: Se guarda estado de sesión en caché usando `sessionStorage` (Búsquedas recientes).
- **Control de Carreras Web (Aborts)**: El frontend siempre incluye un `AbortController` debounced (300ms) que frena queries viejos al tipear muy rápido.
- **Fallback UX Inteligente**: Si la búsqueda arroja `0 resultados`, el motor atrapa el evento y arroja heurísticas de fallback (Ej: "Intenta con menos palabras", o resultados recomendados globales).

## 📈 Lógica de Ranking Algorítmico y Health Source

Todo el sistema de listing no exhibe los "elementos más nuevos", sino "Los Elementos de Más Alta Calidad".

El score final por actividad (calculado en `src/modules/activities/ranking.ts`) sigue la fórmula:

```
rankingScore = (relevance × 0.5) + (recency × 0.2) + (trustScore × 0.3) + ctrBoost
```

- **50% Relevancia (`relevance`)**: Score base de afinidad con el contenido. Inicialmente 0.7 uniforme; en búsqueda textual se enriquece con `pg_trgm` (`+5.0` exact match, `+3.0` prefix ilike) ponderado 0.7/0.3 + prefix boost +0.10.
- **20% Recencia (`recency`)**: Freshness de la actividad en BD. ≤3 días = 1.0 | ≤7 días = 0.8 | ≤30 días = 0.5 | >30 días = 0.2.
- **30% Confianza de Fuente (`trustScore`)**: Extraído del `SourceHealth`. Fuentes inestables pierden posicionamiento global. Dominio con ratio < 0.3 → bloqueado. Score neutral 0.5 si el dominio aún no ha sido medido.
- **CTR Boost (`ctrBoost`)**: Señal aditiva real de comportamiento de usuario — `outbound_click / activity_view` por dominio. Valor máx +0.15. **No reemplaza** las señales base, las complementa.

  | CTR del dominio | Boost aplicado |
  |---|---|
  | > 30% | +0.15 |
  | > 15% | +0.08 |
  | > 5% | +0.03 |
  | ≤ 5% | 0 |

### Search Hybrid Ranking (Búsqueda Activa)

Cuando un usuario realiza una búsqueda textual explícita (`?q=...`), el algoritmo cambia hacia un **Ranking Híbrido** más dinámico:

```
hybridScore = (textScore × 0.50) + (healthScore × 0.25) + (ctrBoost × 0.15) + (recency × 0.10)
```

- **Relevancia Textual (50%)**: Match por trigramas (`pg_trgm`) en título y descripción.
- **Confianza de Fuente (25%)**: Estabilidad del proveedor.
- **Interacción CTR (15%)**: Desempeño real de clic frente a impresiones.
- **Recencia (10%)**: Se le quita peso a la fecha de publicación para dar prioridad absoluta al término buscado.

- **Completeness Boost (+15%)**: Actividades ricas en metadata reciben una bonificación sumatoria sin ocultar las incompletas: `+5%` por Precio estriado, `+5%` por Rango de Edad explícito, y `+5%` por Geolocalización exacta (`locationId`). 
- **Penalización por Edad Nula (-15%)**: Actividades sin `ageMin`/`ageMax` parseados reciben `score *= 0.85`, garantizando calidad algorítmica en el tope del motor (combinado con el completeness boost, esto genera un delta significativo).

## 🧩 Eventos UX Trackeados (Vínculo al módulo Analytics)

Desde la capa de producto el UI lanza los siguientes eventos vitales en el ciclo de conversión sin requerir librerías externas:
- **`page_view`**: Carga de cualquier ruta Next.js (via `AnalyticsTracker`).
- **`search_applied`**: Al pulsar _Enter_ en sub-query.
- **`activity_click`**: Clics en cards de exploración.
- **`activity_view`**: Clics desde listado al Single Detail Page.
- **`outbound_click`**: Evento final del funnel. (Redirige tráfico pagado o gratis al organizador de la actividad infantil).

## 🔐 Patrón de Autenticación (Intent Manager) — NUEVO v0.11.0-S54

Patrón global y reutilizable para preservar la intención del usuario ante cualquier acción protegida, sin acoplar la lógica de negocio al flujo de login.

**Flujo:**
```
1. Click en acción protegida (ej: FavoriteButton)
2. requireAuth(intent, router)  → verifica sesión async (Supabase)
3. Sin sesión: IntentManager.save(intent) + router.push('/login')
4. Login exitoso
5. IntentResolver (global, layout) → consume intent una sola vez
6. Ejecuta acción (toggleFavorite) + toast.success + router.replace(returnTo)
```

**Reglas:**
- Todos los flujos protegidos usan `requireAuth` — nunca redirect manual a `/login`.
- `IntentManager` usa `localStorage` con TTL 15 min — expire silencioso.
- `IntentResolver` usa `useEffect([])` — ejecución única al montar, idempotente.
- Errores se manejan silenciosamente para no romper el login flow.

## 🔲 Estados de Interfaz (UI States)

### Reglas Globales
- Nunca usar spinners bloqueantes como estado principal.
- Siempre preferir Skeletons que preserven layout (no CLS).
- Todo listado debe definir explícitamente: loading, empty, error.

### Loading (Skeleton)
- Se usa `<Skeleton />` replicando layout final.
- Debe evitar layout shift (CLS ≈ 0).

### Empty State
- Se usa `<EmptyState />`.
- Debe incluir:
  - mensaje claro
  - acción de salida (CTA)
- Nunca dejar pantallas vacías sin contexto.

### Error State
- Errores de ruta → `error.tsx` (Next.js boundary).
- Errores de interacción → `useToast()` (no bloqueante).

## 🏷️ Terminología Oficial (Naming Convention)

### Regla SSOT
- Término único: **"Actividades"**

### Prohibiciones
- No usar: "Planes", "Eventos", "Citas" en UI.
- "Evento" solo permitido en contexto técnico (analytics).

### Enforcement
- Cualquier PR que introduzca terminología distinta debe ser rechazado.

## 🎨 Identidad Visual y Branding (v0.13.2)

HabitaPlan cuenta con un sistema de branding completamente controlado por código, con reglas que son parte del Design System oficial.

### Assets Oficiales
- `/public/logo.svg` — Logo completo (light mode). Source of Truth.
- `/public/logo-dark.svg` — Logo completo (dark mode). Solo cambia el texto "Habita" a blanco.
- `/public/logo-icon.svg` — Ícono solo (sin texto), para favicons y navbar compacta.
- `/public/favicon.png` — 32×32, generado automáticamente desde `logo-icon.svg`.
- `/public/apple-touch-icon.png` — 180×180, generado automáticamente.
- `/public/og.png` — 1200×630, Open Graph para previews sociales.

### Pipeline de Generación Automática
Los assets derivados (favicon, apple-touch, og) **se regeneran en cada build** vía `npm run generate:brand` (precondición del `npm run build`). Nadie los edita a mano.

```bash
npm run generate:brand  # genera public/og.png, public/favicon.png, public/apple-touch-icon.png
npm run validate:logo   # valida que los SVGs no tengan fondos falsos (pre-commit hook)
```

### Reglas de Uso en UI
- Logo siempre en esquina superior izquierda del header.
- Cambio de tema: reemplazo de asset, **nunca filtros CSS** (`invert`, `brightness`).
- Mínimo: 120px de ancho para el logo completo, 16px para el ícono.
- Consultar `docs/modules/design-system.md` para el contrato completo.
