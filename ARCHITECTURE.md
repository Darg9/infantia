![Test Status](https://img.shields.io/badge/tests-6%2F6-brightgreen)

# Habit Challenge: Documento de Producto y Arquitectura

Este documento rige las especificaciones del producto, técnicas y la arquitectura del proyecto "Habit Challenge", construido en marzo de 2026.

---

## 1. Visión del Producto

**Habit Challenge** es una plataforma gamificada diseñada para que personas de todas las edades (niños, familias, adolescentes, y adultos) establezcan, hagan seguimiento y consoliden hábitos positivos a lo largo del tiempo. 

El núcleo del producto es la motivación a través de:
1. **Rachas (Streaks):** Seguir realizando una acción día a día.
2. **Sistema de Puntuaciones (Rewards):** Ganar experiencia según la dificultad del hábito.
3. **Leaderboards Globales:** Competir de manera sana con la comunidad mundial.
4. **Duelos 1v1 (Peer Challenges):** El aspecto más interactivo; retar a un amigo con una "apuesta" o "penitencia". Quien rompa la racha primero, paga.

### Regulación Temprana y Protección al Menor
Dada la naturaleza competitiva y la escalabilidad de la plataforma hacia verticales como colegios y familias, el producto integra un sistema CERO-TOLERANCIA de **Feature Flags** basados en **COPPA (Children's Online Privacy Protection Act)** y sentido común:
- **TINY (<5 años) & KID (6-9):** Entorno altamente protegido. Usan cuentas controladas. Funciones sociales (como Duelos 1v1) están bloqueadas estrictamente desde el código.
- **PRETEEN (10-14):** Funciones sociales (Duelos) limitadas a "Modo Seguro" con penitencias pre-aprobadas y sin exposición pública riesgosa.
- **TEEN (15-18) & ADULT (18+):** Acceso a mecánicas competitivas y stakes personalizados completos con protección moderada.

---

## 2. Pila Tecnológica (Tech Stack)

El proyecto fue desarrollado pensando en alto rendimiento, bajo costo inicial, Server-Side Rendering (SSR) dinámico y una rampa de progresión sencilla hacia arquitecturas sin servidor (Serverless).

* **Framework Principal:** Next.js 16.1 (App Router) + React 19.
* **Lenguaje:** TypeScript estricto.
* **Motor UI y CSS:** Tailwind CSS v4.0. Se utiliza el esquema de variables globales en CSS estándar para manejar los temas (`globals.css`), sin engrosar la configuración de Tailwind.
* **Base de Datos Local:** SQLite (para desarrollo rápido vía `dev.db`).
* **ORM:** Prisma v6.19. (Fácilmente escalable a PostgreSQL migrando la variable de entorno `DATABASE_URL` y el provider en `schema.prisma`).
* **Autenticación:** NextAuth.js (Auth.js) v5 - `beta`. Implementado actualmente con el proveedor Credentials (Email/Contraseña) encriptado con `bcryptjs`.
* **Animaciones & Iconografía:** Framer Motion y Lucide React.

---

## 3. Arquitectura del Sistema

### 3.1 Estructura de Directorios (Next.js App Router)
El proyecto utiliza una estructura modular enfocada en la mantenibilidad.

```
/habit/src/
  ├── app/                        # Rutas de la aplicación (Next.js App Router)
  │    ├── globals.css            # Sistema de Diseño y Design Tokens
  │    ├── layout.tsx             # Root layout y protección de hidratación
  │    ├── page.tsx               # Landing Page pública
  │    ├── admin/                 # Panel de Administración de módulos
  │    ├── api/                   # Backend / REST API Routes
  │    │    ├── auth/             # Rutas dinámicas de autenticación
  │    │    └── checkin/, duels/  # Lógica de servidor y guardado de DB
  │    ├── dashboard/             # SPA privada del usuario (Layout propio)
  │    ├── login/                 # Vistas públicas de autenticación
  │    └── register/              # Logica de registro y asignación de edad
  ├── components/                 # Componentes compartidos y UI pura
  ├── lib/                        # Singletons y clientes (ej. Prisma, Auth)
  ├── modules/                    # Lógica de dominio aglomerada (Features)
  │    ├── admin/
  │    ├── auth/
  │    ├── checkin/
  │    ├── duels/
  │    └── feature-flags/
  └── types/                      # Declaración de Tipos e Inferencias de Prisma
```

### 3.1 Lista de Endpoints (Autogenerado)
<!-- AUTO_GEN_API_START -->
- `/api/activities`
- `/api/activities/[id]`
- `/api/admin/feature-flags`
- `/api/auth/parental-pin`
- `/api/auth/register`
- `/api/auth/[...nextauth]`
- `/api/challenges`
- `/api/checkin/[id]`
- `/api/communities/join`
- `/api/communities`
- `/api/duels`
- `/api/push/subscribe`
- `/api/users/audio`
- `/api/users/language`
- `/api/users/search`
- `/api/users/theme`
<!-- AUTO_GEN_API_END -->

### 3.2 Módulos de Lógica (Autogenerado)
<!-- AUTO_GEN_MODULES_START -->
- **activities**: Módulo lógico completo.
- **admin**: Módulo lógico completo.
- **auth**: Contenedor de componentes/utilidades.
- **checkin**: Contenedor de componentes/utilidades.
- **communities**: Contenedor de componentes/utilidades.
- **duels**: Contenedor de componentes/utilidades.
- **feature-flags**: Módulo lógico completo.
- **notifications**: Módulo lógico completo.
- **providers**: Módulo lógico completo.
- **scraping**: Módulo lógico completo.
- **search**: Módulo lógico completo.
- **shared**: Contenedor de componentes/utilidades.
- **users**: Módulo lógico completo.
- **verticals**: Módulo lógico completo.
<!-- AUTO_GEN_MODULES_END -->

### 3.2 Diagrama de Base de Datos (Modelo Relacional Prisma)

1. **User:** Modela al jugador. Define roles (`isAdmin`), Puntos totales, URL de Avatar, Grupo de Edad (inferido auto-exclusivamente desde `birthdate`), y asocia los hábitos y checkins.
2. **Challenge:** El diccionario maestro de hábitos definidos (Categorías, Puntos base de dificultad, Frecuencia). Pueden ser públicos u ocultos.
3. **UserChallenge:** La tabla pivote/Inscripción. Registra cuándo un `User` acepta un `Challenge`. Lleva el conteo de la `currentStreak` y la `bestStreak`.
4. **CheckIn:** El evento cronológico inmutable (audit-log). Cada vez que alguien marca "Hoy lo hice", se crea un CheckIn atado a `UserChallenge` registrando fecha, notas en texto, y los puntos ganados.
5. **PeerChallenge:** Modela los "Duelos 1v1". Une un "Retador" (Challenger) y un "Desafiado" (Challenged) bajo un mismo `challengeId` con una penalidad manual acordada (`stakes`), estado (PENDING, ACTIVE, DECLINED, COMPLETED) y quién ganó (`winnerId`).
6. **FeatureFlag:** Clave-Valor que rige dinámicamente si módulos de la plataforma (ej. `DUELS_SYSTEM`) están encendidos (`enabled: true/false`) y, de ser así, qué grupos demográficos (`allowedAgeGroups: "PRETEEN,TEEN,ADULT"`) pueden acceder sin desplegar código nuevo.

---

## 4. Diseño del Sistema (Design System)

La aplicación renuncia al diseño genérico y acata las corrientes modernas visuales:
* **Glassmorphism:** Uso intensivo de fondos difuminados (`backdrop-blur-xl`, `bg-surface-800/80`), ideal para dar profundidad.
* **Dark Theme First:** Colores base definidos en hexadecimales profundos (`#0f172a` al `#1e293b`), usando luces de neón en tonos turquesa/indigo (`brand`) y coral/rosa (`accent`).
* **Animaciones Orgánicas:** `framer-motion` usado para micro-interacciones (fades, hover effects) y listados interactivos como el Leaderboard.

---

## 5. Decisiones de Ingeniería Críticas

### Motor de Rachas (Streaks Engine)
El cálculo de rachas no exige un trabajo esclavo cron (CRON job) de base de datos revisando miles de usuarios diarios a la media noche (costoso a gran escala). 
El recálculo ocurre *en caliente* (Just-In-Time) durante el endpoint `POST /api/checkin/[id]`. Cuando el usuario hace click:
1. Compara `today` vs `lastCheckInDate`.
2. Si fue *Ayer*, suma `streak + 1`. 
3. Si fue *Antes de Ayer*, se rompió la racha y guarda `streak = 1`. 
4. Otorga puntos basándose en `PuntosDificultad * BonoDeRacha`.
5. Inserta CheckIn y actualiza Usuario dentro de un `$transaction` atómico de Prisma para garantizar integridad de datos.

### Feature Flags "Smart"
Puesto que las edades se calculan con máxima rigidez en backend basado en la fecha de nacimiento (`YYYY-MM-DD`), el servidor tiene el veredicto final sobre la bandera. Si el administrador apaga globalmente el "Catálogo", bloquea la renderización en el servidor (`layout.tsx`) antes de enviar ni siquiera el HTML al cliente, siendo altamente seguro y hermético a inyecciones.

### Control Parental (PIN Protection)
Hemos implementado una capa adicional de seguridad para menores controlada por el Feature Flag `PARENTAL_CONTROL`:
1.  **Bloqueo de Perfil:** Los campos sensibles (nombre, email, fecha de nacimiento) se oscurecen (blur) en la interfaz si el usuario pertenece a un grupo restringido.
2.  **Verificación por PIN:** Para desbloquear estos ajustes, el tutor debe configurar e introducir un PIN de 4 dígitos.
3.  **Seguridad:** El PIN se almacena en la base de datos de forma segura usando hashing con **bcryptjs**, siguiendo los estándares de seguridad de nivel industrial.

### Temas y Diseños Personalizados
Implementado para mejorar la experiencia de usuario y accesibilidad:
1.  **Modos Disponibles:** Estándar (Dark), Claro, Niños (Azul/Verde) y Niñas (Rosa/Púrpura).
2.  **Arquitectura CSS:** Uso de variables CSS nativas y el atributo `data-theme` en la etiqueta raíz (`html`) para cambios en cascada sin recarga de página.
3.  **Persistencia:** La preferencia se almacena en el modelo `User` y se inyecta en la sesión de Auth.js para una carga inmediata desde el servidor (RSC).
4.  **Feature Flag:** La opción es controlable mediante `THEME_SELECTION`.

### Accesibilidad (Audio Support)
Integrado bajo la bandera `AUDIO_SUPPORT`:
1.  **Text-to-Speech (TTS):** Utiliza la API nativa de Web Speech para leer contenidos en voz alta, adaptándose al idioma seleccionado por el usuario.
2.  **Optimización para Niños:** El tono y la velocidad de lectura están ajustados para facilitar la comprensión en menores.

### Extensibilidad de Idiomas (i18n)
El sistema está diseñado para crecer sin cambios en la arquitectura:
1.  **DICCIONARIOS:** Para añadir un idioma (ej. Alemán), solo hay que añadir la clave `de` en `src/locales/dictionaries.ts`.
2.  **MAPEO AUTOMÁTICO:** El componente `LanguagePicker` y la utilidad `i18n` detectarán automáticamente el nuevo idioma y lo ofrecerán en el dashboard.

### Autenticación Social (SSO Multiproveedor)
Implementado bajo un esquema de doble capa de seguridad:
1.  **Flags de Control:**
    - `SSO_MASTER`: Habilita/deshabilita todo el bloque social.
    - `SSO_META`, `SSO_GOOGLE`, `SSO_APPLE`, `SSO_MICROSOFT`: Permiten activar proveedores específicos según la plataforma de la vertical (ej. Microsoft para escuelas).
2.  **Proveedores:** Integración completa con **Facebook, Google, Apple y Microsoft Entra ID** usando Auth.js v5.
3.  **Seguridad:** El sistema utiliza OAuth 2.0 y permite la vinculación de cuentas si el correo electrónico coincide.

### Rendimiento Vercel/Next.js
Todas las llamadas a bases de datos iniciales en los dashboards (como la búsqueda del Top 50 Leaderboard) se realizan mediante **React Server Components (RSC)**. Esto extrae toda carga analítica del dispositivo cliente (celular de gama baja, por ejemplo), renderiza el HTML y envía solo el markup hiper-optimizado junto con pedacitos mínimos de JS en los "Client Components" estrictamente necesarios (como los botones de Like o CheckIn).

### UX & Premium Polish (Sonner + Framer Motion)
Hemos elevado la calidad percibida de la aplicación:
1. **Notificaciones (Sonner):** Feedback visual inmediato para acciones críticas (Auth, Ajustes).
2. **Skeleton Loading:** Reducción del CLS y mejora de la percepción de carga en el Dashboard mediante siluetas animadas.
3. **Transiciones (Page Transitions):** Uso de `AnimatePresence` para cambios de ruta fluidos.

### Cumplimiento Legal (Ley 1581 - Colombia)
La app integra mecanismos de protección de datos personales:
1. **Consentimiento Explícito:** Registro condicionado a la aceptación de términos.
2. **Autorización Parental:** Detección de menores de 14 años para requerir validación de tutores legales.
3. **Páginas de Soporte:** `/privacy` y `/terms` adaptadas a la legislación vigente.
