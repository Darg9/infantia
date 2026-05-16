# Roadmap de Producto y UX: La Era de la Abundancia (Post-V3)
**Versión:** v0.21.1
**Última actualización:** 16 de mayo de 2026

Con la infraestructura base resuelta (Adquisición, Ranking, SEO, Diversidad), el enfoque del ecosistema HabitaPlan transiciona de "almacenar y clasificar datos" a **"gestionar la calidad emergente y el descubrimiento"**.

La siguiente es la hoja de ruta estratégica para auditar y evolucionar la plataforma frente al volumen masivo.

## 1. Observabilidad y Analytics (Foco Inmediato)
El sistema debe comenzar a generar señales reales sobre cómo los usuarios interactúan con la abundancia.
- **CTR por tipo de evento:** ¿Qué categorías atraen clicks reales vs. impresiones?
- **Scroll depth & Feed abandonment:** ¿La gente se aburre en la página 2? ¿El ranking retiene la atención?
- **Zero-result searches:** ¿Qué busca la gente que aún no tenemos?
- **Review throughput:** ¿A qué velocidad se satura la revisión humana?

## 2. Search UX y Discovery UX (Foco Inmediato)
En la abundancia, "encontrar" es mucho más difícil que "almacenar".
- **Tolerancia a errores:** ¿La búsqueda perdona *typos* o nombres parciales?
- **El Momento "Wow":** ¿El usuario descubre algo inesperado e inspirador en los primeros 5 segundos en el Home?
- **Filtros sin salida:** Evitar combinaciones de filtros (ej. "Teatro" + "Suba" + "Gratis") que generen páginas muertas.

## 3. Arquitectura de Entidades (El Próximo Salto)
Para gobernar el *Semantic Dedupe* y el *SEO Moat*, HabitaPlan debe dejar de pensar solo en `Activities` y empezar a pensar en **Entities**.
- **Entidades necesarias:** `Venues` (Lugares físicos), `Organizers` (Idartes, BibloRed), `Recurring Programs` (Clubes de lectura).
- *Impacto:* Esto habilitará personalización real, deduplicación exacta, y páginas hiperlocales de alta autoridad SEO.

## 4. Sistema de Recomendación (Similitud Avanzada)
El bloque de "Actividades Similares" debe convertirse en el sistema nervioso central de la retención.
- Evolucionar de *similitud básica* a vectores como: "Mismo rango de edad", "Mismo mood (Indoor/Outdoor)", "Cerca de aquí", o "Comportamiento recurrente".

## 5. Conversión Emocional y Mobile UX
HabitaPlan no es un buscador funcional, es **inspiración familiar**.
- **Mobile First:** Densidad visual correcta para el scrolling cansado de un padre/madre. Botones de compartir sin fricción para WhatsApp.
- **Transmisión de Vida:** ¿La interfaz grita "Bogotá está llena de cosas pasando hoy"? ¿Reduce la ansiedad de decidir un plan para el fin de semana?

## 6. Trust & Safety Editorial
Al manejar audiencias infantiles, la confianza es el KPI máximo.
- **Verification layers:** Badges de confianza para organizadores recurrentes.
- **Report flows:** Mecanismos fluidos para que la comunidad reporte eventos cancelados, cobros ocultos o errores de rango de edad.
- **Freshness guarantees:** Asegurar al usuario que un evento de mañana *sigue en pie*.

## 7. Rendimiento Real y Growth Loops
- **Performance de Abundancia:** Medir *Hydration cost*, *Query latency* y latencia de paginación.
- **Flywheel de Growth:** Activar mecánicas de compartir, alertas de "Nuevos eventos gratis en mi localidad", o newsletters hiperlocales automatizados.

---
**Conclusión:** El próximo gran foco operativo no es programar más scrapers, sino implementar **Observabilidad** y **Discovery UX**. El sistema está listo para absorber aprendizaje sin destruirse; el desafío ahora es operar esa abundancia sin perder la coherencia editorial.
