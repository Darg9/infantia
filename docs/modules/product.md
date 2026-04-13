# Módulo: Producto y Experiencia de Usuario (UX)

**Versión:** ✅ v0.11.0-S42

Este documento traza los lineamientos funcionales y lógicos que dictan la experiencia de navegación para los cuidadores y publicadores dentro de HabitaPlan.

## 🧭 Flujos de Usuario Principales

1. **Onboarding Contextual** (`/onboarding`): Sistema rápido de 3 pasos (Ubicación -> Dependientes/Niños -> Configuración Base). Define la visualización del contenido.
2. **Hero Search** (Búsqueda Principal): Un ecosistema compuesto capaz de devolver predicciones mixtas. Enlaza con el listado `/actividades`.
3. **Listado de Actividades**: Experiencia de filtros facetados (que actualizan conteos reales de categorías concurrentes en PostgreSQL vs Memoria Node).
4. **Detalle de la Actividad**: Resumen unificado por la IA de NLP, protegiendo sobre cargas cognitivas o fotos gigantes cuando el texto es la metadata esencial. Enlaza siempre hacia la ruta saliente `outbound_click`.

## 🔍 Motor de Búsqueda y Filtros (`HeroSearch` & `Filters`)

El buscador está diseñado para proveer una sugerencia fluida de resultados.
- **Mix de Resultados**: Muestra hasta 5 entidades agrupadas (3 Actividades, 1 Categoría, 1 Ciudad). Esto evita que una categoría inunde y tape resultados directos.
- **Tolerancia a "Fuzzy Matching" (pg_trgm)**: Soporta errores ortográficos e inversión de sílabas. Configurado a `similarity > 0.2` en Prisma `$queryRaw` para no quebrar la DB con comodines `%`.
- **LRU Cache & History**: Se guarda estado de sesión en caché usando `sessionStorage` (Búsquedas recientes).
- **Control de Carreras Web (Aborts)**: El frontend siempre incluye un `AbortController` debounced (300ms) que frena queries viejos al tipear muy rápido.

## 📈 Lógica de Ranking Algorítmico y Health Source

Todo el sistema de listing no exhibe los "elementos más nuevos", sino "Los Elementos de Más Alta Calidad":

El resultado final evaluado localmente (vía map memory) por _Actividad_ resulta de:
- `50% Relevancia`: Concordancia estricta del NLP de contenido al perfil del listado.
- `20% Freshness (Recency)`: Escalado inverso (1 punto para <3 días desde publicación; decae logarítmicamente hasta 0.2 a 30+ días).
- `30% Health Trust Score`: Extraído de la evaluación del _SourceHealth_. Fuentes (DOMINIOS) con alto índice de fallos, falsos positivos o inestabilidad pierden posicionamiento global en la plataforma. Dominios con ratio < 0.3 terminan bloqueados.

## 🧩 Eventos UX Trackeados (Vínculo al módulo Analytics)

Desde la capa de producto el UI lanza los siguientes eventos vitales en el ciclo de conversión sin requerir librerías externas:
- **`search_applied`**: Al pulsar _Enter_ en sub-query.
- **`activity_click`**: Clics en cards de exploración.
- **`activity_view`**: Clics desde listado al Single Detail Page.
- **`outbound_click`**: Evento final del funnel. (Redirige tráfico pagado o gratis al organizador de la actividad infantil).
