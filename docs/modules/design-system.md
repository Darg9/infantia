# HabitaPlan Design System (v1)

El Design System de HabitaPlan es la fuente única de la verdad para la interfaz. Sus pilares previenen la dispersión visual ("UI drift"), garantizan plena accesibilidad WCAG AA, y agilizan el desarrollo de interfaces sin fricciones por decisiones ad-hoc.

## 1. Principios Core

- **Consistencia Visual**: Jamás se usarán clases Tailwind hardcodeadas (como `bg-orange-600` o `bg-red-500`). Todo recaerá en el vocabulario semántico: `brand`, `success`, `error`, `warning`.
- **Accesibilidad en su Raíz**: Los inputs esconden su label de forma accesible (`sr-only`), las acciones complejas emiten feedback semántico, interactivos proveen \`focus-visible\` states limpios y navegación guiada (`aria-busy`, `aria-label`).
- **Simplicidad Funcional**: Evitar la recarga visual. Las escalas tipográficas y de ritmo (spacing) emplean bases unificadas (múltiplos de 4/8pt) apoyando layouts amplios.

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

- Variables unificadas: `--hp-bg-page`, `--hp-bg-surface`, `--hp-bg-subtle`.
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

### Button (`<Button />`)

- **Propósito**: Ejecuta las llamadas operacionales de navegación o forms.
- **Variantes**:
  - `primary` (default): Acción decisiva del container (Solo 1 por vista o jerarquía).
  - `secondary`: Tareas alternativas (Botones de Cancelar, Menús no resaltados).
  - `ghost`: Acciones de reducida presencia ubicadas como links incrustados.
- **Ejemplo**:
  ```tsx
  import { Button } from '@/components/ui'
  <Button variant="ghost" loading={isSubmitting}>Siguiente</Button>
  ```
- **Nota**: Se extraen los `buttonVariants` explícitamente cuando deban aplicarse a polimórficos como el tag `<Link>`.

### Input (`<Input />`)

- **Propósito**: Atrapa y valida los text-nodes de usuario.
- **Props**: Soporta `label`, `hideLabel` (ideal para buscadores / accesible vía `sr-only`), `error` y `leftSlot` interactivo.
- **Ejemplo**:
  ```tsx
  <Input label="Correo" error="Dominio inválido" />
  ```

### Card (`<Card />`)

- **Propósito**: Superficie base enmarcadora que aporta las sombras, radius, y borders uniformes.
- **Ejemplo**:
  ```tsx
  <Card className="max-w-md p-8"> {/* Layout Interno */} </Card>
  ```

### Avatar (`<Avatar />`)

- **Propósito**: Renderiza rostros o iniciales dinámicas para cuentas.
- **Props**: Soporta `src`, fallbacks (`name`), tamaño `size`, interactividad `editable` y loading spin (`uploading`).
- **Ejemplo**:
  ```tsx
  <Avatar name="Roberto" uploading={isUploading} size="lg" />
  ```

### Toast (`useToast`)

- **Propósito**: Notificaciones cruzadas FIFO (cap de 3 visibles).
- **Regla**: Los toasts de \`error\` deben empatar con mensajes inline de inputs donde aplique, reforzando a11y. Los \`success\` van nativamente aislados en toast para no arruinar UI. Soporta \`deduplicación\` nativa.
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
- Todos los inputs que emitan queries complejos (ej. `HeroSearch`) portan \`hideLabel\` para que convivan en Single Lines, mientras su Screen Reader lee correctamente su propósito.
- Abort controllers para Debounces, liberando calls de network desactualizadas.

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
