# HabitaPlan Design System (v2 — v0.17.0-beta)

El Design System de HabitaPlan es la fuente única de la verdad para la interfaz. Sus pilares previenen la dispersión visual ("UI drift"), garantizan plena accesibilidad WCAG AA, y agilizan el desarrollo de interfaces sin fricciones por decisiones ad-hoc.
*Nota v0.17.0-beta: Estabilización estructural + ESLint freeze (alert/prompt/confirm bloqueados). Toast SSOT activo.*

## 1. Principios Core

- **Consistencia Visual**: Jamás se usarán clases Tailwind hardcodeadas (como `bg-orange-600` o `bg-red-500`). Todo recaerá en el vocabulario semántico: `brand`, `success`, `error`, `warning`.
- **Accesibilidad en su Raíz**: Los inputs esconden su label de forma accesible (`sr-only`), las acciones complejas emiten feedback semántico, interactivos proveen `focus-visible` states limpios y navegación guiada (`aria-busy`, `aria-label`).
- **Simplicidad Funcional**: Evitar la recarga visual. Las escalas tipográficas y de ritmo (spacing) emplean bases unificadas (múltiplos de 4/8pt) apoyando layouts amplios.

## 🎨 Estilos

- ❌ No usar clases de colores directos Tailwind (`bg-red-500`, `text-blue-400`, `border-gray-200`)
- ❌ No usar hex values
- ✔ Usar tokens dinámicos (`hp-*`) para colores y backgrounds
- ✔ Usar clases utilitarias neutras libremente (`text-xs`, `bg-transparent`, `border-b`)
- ✔ Usar componentes del DS

### Enforcement
ESLint (`no-restricted-syntax`) bloquea mecánicamente el uso de colores nativos Tailwind en props `className`, asegurando que el theming global pase por variables CSS, pero evitando falsos positivos en utilidades estructurales.

## 🖼️ Logo Asset Rules

Todo asset de marca (logo, isologo, isotipo) debe pasar validación automatizada (`npm run validate:logo`) y cumplir estrictamente esta jerarquía arquitectónica:

- **Source of Truth:** SVG
- **Derivados Aprobados:** PNG optimizado
- **Rol de la IA:** Solo referencia y conceptualización (no productiva).

### Restricciones para Derivados (PNG)
- **Transparencia:** Debe tener canal Alpha real comprobable.
- **Prohibiciones Absolutas:**
  - Sombras o drop-shadows incorporados.
  - Brillos / glow effects.
  - Fondos falsos blancos/negros o cuadrículas quemadas.
  - Transparencias parciales masivas (halos, mal blending).
- **Resoluciones Aprobadas:**
  - Base exportado: 512x512
  - Versión optimizada: 256x256
  - Favicon: 128x128

Estas directrices previenen assets defectuosos, asegurando la consistencia limpia sobre múltiples temas (`light`, `dark` y *high-contrast*). No se confía en inputs externos: ni humanos, ni de Inteligencia Artificial. Todo asset es verificado programáticamente.

## 🌓 Asset Theming (Light / Dark Mode)

HabitaPlan utiliza dos variantes oficiales del logo según el contexto visual para garantizar accesibilidad y legibilidad máxima.

### Variantes
- `/logo.svg` → Uso exclusivo en fondos claros.
- `/logo-dark.svg` → Uso exclusivo en fondos oscuros.

### Reglas de Implementación
- El logo **nunca se modifica dinámicamente** mediante CSS (nada de filtros, ni opacidad, ni `invert()`).
- La adaptación al modo oscuro se realiza **únicamente por reemplazo físico de asset**.
- La única diferencia formal permitida entre los SVGs es el color del texto de la palabra "Habita":
  - Light Mode: Azul Navy (`#0F1D38`)
  - Dark Mode: Blanco Puro (`#FFFFFF`)
- El color acento de la palabra "Plan" (`#F57321`) y la composición base del isotipo **nunca cambian**.

### Implementación Obligatoria

```tsx
<img src="/logo.svg" className="dark:hidden" />
<img src="/logo-dark.svg" className="hidden dark:block" />
```

### Prohibiciones
- ❌ Usar un solo logo estático para ambos modos (afecta la legibilidad en Dark Mode).
- ❌ Aplicar filtros CSS (`invert`, `brightness`, etc.) para simular el modo oscuro.
- ❌ Cambiar colores fuera de la paleta permitida.
- ❌ Alterar las proporciones, *viewBox* o layout interno del logo entre ambas versiones.

### Tamaños Mínimos y Legibilidad

**Logo completo (icono + texto)**
- **Mínimo absoluto:** 120px ancho
- **Recomendado:** ≥ 160px
- **Navbar mobile:** 32px alto (`h-8`)
- **Navbar desktop:** 40px alto (`h-10`)

**Ícono solo (`logo-icon.svg`)**
- **Mínimo absoluto:** 16px
- **UI estándar:** 20–24px
- **Favicon base:** 32px (renderizado downscale a 16px)

**Reglas de Escalado**
- No escalar por debajo del mínimo → pérdida de legibilidad.
- No separar icono y texto manualmente.
- Mantener proporción original (no *stretch*).

### Uso en Navbar

**Objetivo:** Garantizar visibilidad, jerarquía y consistencia en navegación principal.

**Implementación estándar:**
```tsx
<img src="/logo.svg" className="dark:hidden h-8 md:h-10 w-auto" alt="HabitaPlan" />
<img src="/logo-dark.svg" className="hidden dark:block h-8 md:h-10 w-auto" alt="HabitaPlan" />
```

**Reglas de Navbar:**
- El logo siempre se ubica en la esquina superior izquierda (o centrado en mobile si es requerido por el grid, aunque se prefiere izquierda).
- Debe tener suficiente espacio respecto a otros elementos (≥ 16px).
- No competir visualmente con CTAs (evitar botones del mismo color dominante al lado).
- No aplicar efectos hover complejos.
- Comportamiento: Click en logo → navegación a `/` con cursor `pointer`.

### Uso en Favicon

**Fuente oficial:** `/public/logo-icon.svg`

**Implementación recomendada:**
```html
<link rel="icon" href="/logo-icon.svg" type="image/svg+xml" />
```

**Alternativa (compatibilidad legacy):** `/public/favicon.ico`

**Reglas de favicon:**
- Usar solo el ícono (no texto).
- Debe ser legible en 16px.
- Sin detalles finos (evitar ruido visual).
- Mantener contraste alto.

### Uso en Open Graph (Social Preview)

**Archivo:** `/public/og.png` (1200x630)

**Contenido:**
- Fondo limpio (blanco o color de marca).
- Logo centrado o alineado.
- Sin saturación de elementos.

**Implementación en App Router:**
```tsx
export const metadata = {
  openGraph: {
    images: ["/og.png"],
  },
};
```

### Checklist de Validación (QA)

Antes de hacer un merge que afecte el Header o Layout base, verificar:
- [ ] Logo visible en light mode
- [ ] Logo visible en dark mode
- [ ] Tamaño correcto según contexto
- [ ] Click navega a `/`
- [ ] Favicon visible en browser tab
- [ ] No hay distorsión o blur

### Regla de Enforcement Final
El logo es la pieza central del sistema de identidad. **Cualquier uso fuera de estas reglas documentadas se considera deuda técnica y debe ser refactorizado.**

## 🧱 Uso de Primitivos

- ❌ No usar `<button>` nativo
- ❌ No usar `<input>` nativo
- ✔ Usar `<Button />`, `<Input />`, etc.

### Motivo
- consistencia
- accesibilidad
- control centralizado

### ⚠️ Regla de Primitivos de Base (Prevención de Maximum Call Stack)
Dentro de la carpeta `src/components/ui/`, **jamás** se debe reemplazar el tag HTML nativo raíz por su propio componente exportado.
- ❌ En `button.tsx`: `<Button>` envolviendo a `<Button>` (Causa SSR Crash Infinito).
- ✔ En `button.tsx`: `<button>` nativo envuelto con React.forwardRef.
- Los imports de componentes de UI deben hacerse hacia sus archivos individuales para evitar Circular Dependencies en los Barrels (`index.ts`).

---

## 2. Tokens Oficiales

Todas nuestras definiciones base yacen configuradas en el motor `@theme` de *Tailwind* V4, inyectadas localmente dentro del layer en `globals.css`.

### Colores Semánticos

| Variant   | Clases útiles (`text-*`, `bg-*`) | Rol principal                                              |
| --------- | ---------------------------------- | ---------------------------------------------------------- |
| **Brand**   | `brand-50` al `brand-900`            | Identidad HabitaPlan (Hero action, primary links, focus).  |
| **Success** | `success-50` al `success-700`        | Acciones resueltas, toasts positivos.                      |
| **Error**   | `error-50` al `error-600`            | Errores destructivos, state inválido de Input, fail Toast. |
| **Warning** | `warning-50` al `warning-600`        | Advertencias preventivas, empty states blandos.            |

### Superficies & Backgrounds

- Variables unificadas: `--hp-bg-page`, `--hp-bg-surface`, `--hp-bg-subtle`, `--hp-bg-elevated`.
- **Estratificación Elevada (Dark Mode):** Para evitar el aplanamiento de interfaces en temas oscuros, las cards flotantes, el input buscador y los modales deben combinarse siempre con `bg-[var(--hp-bg-elevated)] border-[var(--hp-border-subtle)] shadow-md`. No se debe confiar solo en la sombra, ya que `shadow` pierde efectividad geométrica sobre fondos oscuros.
- Texto Nativo: `--hp-text-primary`, `--hp-text-secondary`, `--hp-text-muted`.

### Dark Mode

- **Regla Estricta de Paridad**: Se emplea soporte server-side inyectado (`Cookie SRR`), requiriendo que los componentes invirtan sin clases hardcodeadas (`dark:bg-gray-800`).
- No deben existir colores exiliados del dark mode scheme. Si es blanco en light, debe resolverse automáticamente apoyándose en los tokens designados (o el variant dark invertido `dark:text-white`).

### Tipografía, Spacing & Shadows

- Spacing core: Multiplos de 4px, salto natural `8pt` (`space-y-4`, `p-8`).
- Radio general: Estándar `rounded-lg` / `rounded-xl`.
- Componentes modales o flotantes (`Card`, `Dropdown`): Emplean Drop Shadows (`shadow-md` a `shadow-lg`).

---

## 3. Catálogo de Componentes (Primitives)

Todo reside exportado limpiamente en su Barrel `src/components/ui`.

## 📦 Regla de Documentación de Componentes

El Design System debe reflejar exactamente las props disponibles en el código.

**Fuente única:**
- `/src/components/ui/*`

**Regla:**
- Si existe en código → debe documentarse
- Si no está documentado → no se considera soportado

### `<Button />`

**Props:**
- `variant`: `primary` | `secondary` | `ghost` | `destructive`
- `size`: `sm` | `md` | `lg`
- `loading`: boolean

**Propósito**: Ejecuta llamadas operacionales de navegación o forms.

### `<Input />`

**Props:**
- `label`, `hideLabel`
- `hint`
- `error`
- `leftSlot`, `rightSlot` (icons, toggles)

**Propósito**: Atrapa y valida los text-nodes de usuario.

### `<Avatar />`

**Sizes:**
- `xs` | `sm` | `md` | `lg` | `xl`

**Props:**
- `src`, `name`, `uploading`, `editable`, `onClick`

**Propósito**: Renderiza rostros o iniciales dinámicas para cuentas.

### `<Card />`
**Propósito**: Superficie base enmarcadora que aporta las sombras, radius, y borders uniformes.

### `<Modal />`
**Propósito**: Renderiza diálogos destructivos o de confirmación crítica que requieren bloqueo del canvas.

### Toast (`useToast`)

- **Propósito**: Notificaciones cruzadas FIFO (cap de 3 visibles).
- **Semántica Exacta**: Soporta 4 estados: `success`, `error`, `warning`, `info`. (`toast.warning` maneja recuperables).
- **Enforcement (Zero Debt)**: Uso obligatorio. ESLint (`no-restricted-globals`) bloquea el uso de `alert()`, `confirm()`, `prompt()` y rechaza librerías externas.
- **Regla**: Los toasts de `error` deben empatar con mensajes inline de inputs donde aplique, reforzando a11y. Los `success` van nativamente aislados en toast para no arruinar UI. Soporta `deduplicación` nativa.
- **Ejemplo**:
  ```tsx
  const { toast } = useToast()
  toast.success('Búsqueda depurada')
  toast.error('Sesión vencida')
  ```

### Dropdown (`<Dropdown />`)

- **Propósito**: Mantiene menús contextuales y de navegación anidados (como UserMenu).
- **Key A11y**: Control nativo subyacente para teclas Arrow (⇧/⇩) atrapando el ciclo de focus. Cierra automáticamente con Tabulation y Esc.

---

## 4. Patrones de UX Críticos

### Formularios (Loaders y Races)
- Usar _Double Submit Guard_ atómico en Forms (`isSubmitting` en botones).
- Atar `error` responses del API a mensajes visibles in-DOM de error sobre los Inputs alterados.

### Búsqueda Semántica
- Todos los inputs que emitan queries complejos (ej. `HeroSearch`) portan `hideLabel` para que convivan en Single Lines.
- **Sistema de Buscador Estructurado:** El buscador central opera bajo tres fases de interfaz:
  - **Quick Intents:** Modificadores contextuales (`Hoy`, `Gratis`) anclados muy cerca de la caja de búsqueda. En resoluciones `< md` hacen wrap por debajo; en `>= md` pueden integrarse o flotar contiguos.
  - **Tokens Persistibles:** Las propiedades de búsqueda se sincronizan 1 a 1 en la URL via *Search Params*.
  - **Aborts Controller:** Limpian renders erráticos liberando de memoria los requests obsoletos vía `AbortController`.

### Navegación y Observabilidad
- Los menús y Layout components (Nav, Header, footer) declaran sus Roles Landmark semánticos (`aria-label`).
- Enviar logs del journey en background (`createLogger`), interceptando flujos en subidas y validaciones severas.

---

## 5. Do / Don'ts

| Práctica | Do (Sí) | Don't (No) |
| :--- | :--- | :--- |
| **Colores** | Utilizar uniformente la familia `text-brand-*` , `bg-error-500` | Escapar la semántica por ad hoc strings `bg-orange-600` , `text-red-600`. |
| **Elementos Accionables** | Invocar el primitive genérico `<Button />` o `buttonVariants()` en `<Link>`. | Construir botones inline `<button className="...">`. |
| **Loading Flow** | Delegar el `loading={state}` interno del primitive. | Duplicar svgs spinners sobre layouts dispersos. |
| **Manejo Output** | Inyectar el payload en `toast.error(msg)` global. | Olvidar al usuario dentro de un fallo de API silencioso. |

---

## 6. Integración Técnica Rápida

Los root files inyectan y exponen el ecosistema de importación limpia:

- El Core de Tailwind habita en `src/app/globals.css`.
- Para consumo rápido sin largas rutas de imports, usar el barrel nativo `src/components/ui/index.ts`.

```tsx
// Correcto (Import limpio vía barrel)
import { Button, Input, Card, useToast } from '@/components/ui'
```

---

## 7. Notificaciones y Bloqueos — Reglas Estrictas

El sistema de feedback al usuario es un **monopolio arquitectónico**. Su propósito es garantizar UX no bloqueante y coherente.

## 🚫 Bloqueos y Confirmaciones

- ❌ `window.confirm()` → **PROHIBIDO**
- ❌ `alert()` → **PROHIBIDO**
- ❌ `prompt()` → **PROHIBIDO**

### Regla
Todas las acciones destructivas deben usar `<Modal />`.

### Ejemplos obligatorios
- Eliminar elemento
- Cerrar sesión crítica
- Acciones irreversibles

### Motivo
- UX consistente
- Control de estilo
- Accesibilidad

### Enforcement
Cualquier PR que use APIs nativas bloqueantes debe ser rechazado.

### Notificaciones (Toasts)

| Método | Estado | Motivo |
|---|---|---|
| `useToast()` (interno) | ✅ **Único válido** | SSOT de feedback — cola FIFO, auto-dismiss 4s |
| `react-hot-toast` | ❌ **Prohibido** | Librería externa — rompe Design System |
| `sonner` | ❌ **Prohibido** | Librería externa — rompe Design System |
| `react-toastify` | ❌ **Prohibido** | Librería externa — rompe Design System |

### Enforcement mecánico (ESLint)

Las reglas están activas en `eslint.config.mjs` y **bloquean la compilación CI**:

```js
// no-restricted-globals: bloquea alert() y prompt()
// no-restricted-imports: bloquea react-hot-toast, sonner, react-toastify
```

Si se intenta usar cualquiera de los métodos prohibidos, el IDE mostrará un error inmediato con el mensaje: _"Use useToast instead of alert()"_.

### Configuración del Toast

| Parámetro | Valor |
|---|---|
| Posición mobile | `bottom-center` |
| Posición desktop | `bottom-right` |
| Duración auto-dismiss | 4 segundos |
| Cola máxima visible | 3 toasts simultáneos |
| Acción inline | Permitida (no obligatoria) |

### Uso correcto

```tsx
const { toast } = useToast()

toast.success('Guardado en favoritos', {
  action: { label: 'Ver favoritos →', href: '/perfil/favoritos' }
})
toast.error('Error al guardar')
toast.info('Sesión iniciada')
toast.warning('Acción irreversible')
```

## 🛡️ Validación Visual (Chromatic)

- Todo cambio visual debe pasar Chromatic.
- Cambios no aprobados → **bloquean PR**.

### Regla
El diseño está gobernado por snapshots visuales (SSOT automatizado), no por opinión.
