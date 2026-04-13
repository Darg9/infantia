# Módulo: Analytics (Zero-Dependencies)

**Versión:** ✅ v0.11.0-S42

Este documento explica la infraestructura de rastreo de interacciones web instalada nativamente en HabitaPlan, la cual opera **sin ninguna plataforma de terceros externa (Sin Google Analytics, Segment ni Mixpanel).** 

La meta de este módulo adherido al paradigma "Zero-Debt" es garantizar que la base analítica nunca añada latencia JavaScript en cliente, no cargue scripts asincrónos inyectados globalmente y evite los firewalls ad-blockers al ser considerado tráfico API _first-party_.

## 📊 Diccionario de Eventos a Medir

El sistema es restringido. En vez de almacenar "todo", capta exclusivamente los 5 embudos funcionales que certifican la supervivencia o conversión de un producto:

1. **`page_view`**: Medición clásica de carga de vista Next.js router.
2. **`activity_view`**: Apertura del modal/detalle completo.
3. **`activity_click`**: Clic a una tarjeta en un listado global.
4. **`outbound_click`**: Clic al enlace externo que extrajimos para referir o vender hacia un proveedor (El norte comercial).
5. **`search_applied`**: Registro estricto del input de texto de un usuario evaluando la pertinencia del NLP/Scraper frente a la demanda real local.

## ⚙️ Arquitectura Técnica de Ingesta

El sistema fluye en tres pasos aislados a fin de ser escalable:

### 1. El Emisor Front-End (`src/lib/track.ts`)
Expone la función `trackEvent`. 
- Usa un **Throttling en Memoria** global `lastEventMap`: Cada evento genera un _hash key_. Si se pulsan repetidos clics en el mismo ID de outbound/banner en menos de *1000ms*, el Frontend lo destruye para que no infle métricas.
- Es *Fail-Silent*. Cualquier error se atrapa con un `try / catch` mudo para no tumbar árboles de UI en React.
- Envía via `fetch()` asincrónico a Next.js Serverless Edge. Para asegurar la transmisión incluso cuando cambian de ruta, emplea el prop experimental de la web app API `keepalive: true`.

### 2. El Agregador API (`src/app/api/events/route.ts`)
Recibe vía HTTP POST, purifica y prepara.
- Ignora si falta el type.
- Mapea IP (desde *x-forwarded-for* o *x-real-ip*) y *User-Agent*. Ambos vitales para el motor futuro Antispam y Detección de Bots B2B.

### 3. La Base de Datos (Entity: `Event`)
Un modelo en PostgreSQL que incluye atributos dinámicos bajo tipado robusto `JSONB` de Prisma:
```prisma
model Event {
  id          String   @id @default(uuid())
  type        String
  activityId  String?
  path        String?
  metadata    Json?
  userAgent   String?
  ip          String?
  createdAt   DateTime @default(now())
  
  @@index([type])
  @@index([createdAt])
  @@index([activityId])
}
```

## 📈 Dashboard Interno y KPIs

El dashboard ubicado en `/admin/analytics` totaliza el motor local y consolida métricas base vitales.
1. **Tráfico General Promedio**.
2. **CTR Real**: Proporción matemática extraíble dividiendo conteos (`outbound_click` / `activity_view`). Esto da la efectividad del scraping.
3. **Conversión Orgánica**: Qué actividades incitan al clic una vez el NLP estructuró su visual general.
