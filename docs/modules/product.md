# Módulo: Producto y Experiencia de Usuario (UX)

**Versión:** ✅ v0.11.0-S48
**Última actualización:** 15 de abril de 2026

Este documento traza los lineamientos funcionales y lógicos que dictan la experiencia de navegación para los cuidadores y publicadores dentro de HabitaPlan.

## 🧭 Flujos de Usuario Principales

1. **Onboarding Contextual** (`/onboarding`): Sistema rápido de 3 pasos (Ubicación -> Dependientes/Niños -> Configuración Base). Define la visualización del contenido.
2. **Hero Search** (Búsqueda Principal): Un ecosistema compuesto capaz de devolver predicciones mixtas. Enlaza con el listado `/actividades`.
3. **Listado de Actividades**: Experiencia de filtros facetados (que actualizan conteos reales de categorías concurrentes en PostgreSQL vs Memoria Node).
4. **Detalle de la Actividad**: Resumen unificado por la IA de NLP, protegiendo sobre cargas cognitivas o fotos gigantes cuando el texto es la metadata esencial. Enlaza siempre hacia la ruta saliente `outbound_click`.

## 🔍 Motor de Búsqueda y Filtros (`HeroSearch` & `Filters`)

El buscador está diseñado para proveer una sugerencia fluida de resultados.
- **Mix de Resultados**: Muestra hasta 5 entidades agrupadas (3 Actividades, 1 Categoría, 1 Ciudad). Esto evita que una categoría inunde y tape resultados directos.
- **Búsqueda Avanzada Híbrida (`Search Engine V1`)**: Combina la flexibilidad de `pg_trgm` (tolerancia a errores ortográficos e inversión de sílabas; umbrales: `similarity(title) > 0.25`, `word_similarity(title) > 0.30`, `similarity(desc) > 0.15`; score ponderado 0.7/0.3 + prefix boost +0.10) con una normalización estricta mediante TypeScript. Esta estrategia previene el quiebre de base de datos causado por wildcards masivos `%` y pondera los puntajes antes de regresar los resultados.
- **Normalización de Queries**: Tokeniza la entrada del usuario omitiendo "stopwords", colapsando espacios y reduciendo a la raíz semántica para una mejor correlación.
- **LRU Cache & History**: Se guarda estado de sesión en caché usando `sessionStorage` (Búsquedas recientes).
- **Control de Carreras Web (Aborts)**: El frontend siempre incluye un `AbortController` debounced (300ms) que frena queries viejos al tipear muy rápido.
- **Fallback UX Inteligente**: Si la búsqueda arroja `0 resultados`, el motor atrapa el evento y arroja heurísticas de fallback (Ej: "Intenta con menos palabras", o resultados recomendados globales).

## 📈 Lógica de Ranking Algorítmico y Health Source

Todo el sistema de listing no exhibe los "elementos más nuevos", sino "Los Elementos de Más Alta Calidad":

El resultado final evaluado localmente (vía map memory) por _Actividad_ resulta de una ponderación determinista `((textScore * 0.5) + (healthScore * 0.3) + (ctrBoost * 0.2))`:
- `50% Relevancia (Text Score)`: Suma de proximidad `pg_trgm`, bonificando `+5.0` por el "Exact Match" y `+3.0` por el prefijo ilike.
- `30% Health Trust Score`: Extraído de la evaluación del _SourceHealth_. Fuentes (DOMINIOS) con alto índice de fallos, falsos positivos o inestabilidad pierden posicionamiento global en la plataforma. Dominios con ratio < 0.3 terminan bloqueados.
- `20% CTR Boost Impact`: **(NUEVO)** Señal de conversión real acumulada: `outbound_click / activity_view` por dominio. Boost se aplica como un impacto fundamental.
- **Penalización por Edad Nula (-15%)**: Las actividades que el _Data Pipeline v1_ deja transitar aunque no haya parseado una edad mínima o máxima explícitamente (`null`), corren con una pérdida de posicionamiento masiva de `*= 0.85`, garantizando la máxima calidad algorítmica al tope del Search Engine.

## 🧩 Eventos UX Trackeados (Vínculo al módulo Analytics)

Desde la capa de producto el UI lanza los siguientes eventos vitales en el ciclo de conversión sin requerir librerías externas:
- **`search_applied`**: Al pulsar _Enter_ en sub-query.
- **`activity_click`**: Clics en cards de exploración.
- **`activity_view`**: Clics desde listado al Single Detail Page.
- **`outbound_click`**: Evento final del funnel. (Redirige tráfico pagado o gratis al organizador de la actividad infantil).
