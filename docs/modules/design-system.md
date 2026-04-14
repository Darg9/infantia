# HabitaPlan Design System (Contrato de Diseño)

Este documento es la fuente viva (Single Source of Truth) para el sistema de diseño de HabitaPlan. Garantiza que todos los desarrolladores y agentes mantengan la coherencia visual sin generar deuda técnica por desalineamientos.

## 1. Tokens de Color Semánticos

**Prohibido el uso de colores crudos de Tailwind** (`orange-500`, `green-600`, etc.) para componentes principales. Usar SIEMPRE sus equivalentes semánticos.

### 1.1 Colores Principales (Mapeo a Brand)
- El color primario del proyecto es **Naranja**. En Tailwind está mapeado al scope `brand`.
- **Primary / CTA (Llamados a la acción o botones principales):** `bg-brand-500` (hover: `bg-brand-600`, active: `bg-brand-700`).
- **Superficies destacadas sutiles (Fondo de alertas nativas o highlights):** `bg-brand-50` / `bg-brand-100`.
- **Textos destacados (Enlaces primarios, active indicators):** `text-brand-500` / `text-brand-600`.
- **Focus visible global (AA accesibilidad):** `ring-brand-500` o outline solid en layout principal.

### 1.2 Interfaz de Estado (Semántica)
| Propósito | Token a Usar | Reemplazo de (NO usar) |
|---|---|---|
| **Éxito** (Toasts, validaciones, finalizaciones) | `bg-success-*`, `text-success-*` | `green-500`, `emerald-500` |
| **Error** (Destructive actions, validaciones, fallos) | `bg-error-*`, `text-error-*` | `red-500`, `rose-500` |
| **Peligro / Atención** (Alertas no destructivas) | `bg-warning-*`, `text-warning-*` | `yellow-500`, `amber-500` |

### 1.3 Interfaz de Superficie y Texto (CSS Variables)
Para mantener dark mode de forma automatizada y sin ensuciar los componentes, usamos CSS properties:
- Fondos de página: `var(--hp-bg-page)` (en Tailwind: aplica en clases globales o estilos estructurales).
- Fondos de tarjeta/superficie: `var(--hp-bg-surface)`.
- Texto principal: `var(--hp-text-primary)`.
- Texto secundario: `var(--hp-text-secondary)`.
- Bordes: `var(--hp-border)`.

## 2. Componentes UI Primitivos

Se localizan en `src/components/ui/` y son provistos nativamente mediante el Barrel export (`import { Button, Input, ... } from '@/components/ui'`).

### Button (`<Button>`)
- **Nunca usar `<button className="bg-brand-500">`**.
- Variantes:
  - `primary`: Acción principal por vista (naranja sólido).
  - `secondary`: Acción de resguardo / outline (border brand, texto brand).
  - `ghost`: Sin fondo hasta hacer hover.
  - `destructive`: Acción de daño permanente, cancelar. (rojo sólido).
- **Prohibido:** añadir márgenes (`mt-4`, `mb-2`) dentro de la definición del componente base. El espaciado debe dictarlo el padre layout que los invoca.

### Input (`<InputField>` / `<Input>`)
- Usar el componente estandarizado que maneja `aria-describedby` y `aria-invalid` automáticamente cuando hay props de error.
- Soporta `rightSlot` / `leftSlot` (p.e.íconos de password visibility).

### Card (`<Card>`)
- Container predefinido: aplica correctamente `bg-surface`, `shadow-sm`, y radius.

### Toast / Notificaciones (`useToast`)
- Límite FIFO: 3 toasts en pantalla simultáneamente.
- Dismiss automático: 2500ms.
- API Plana: Nunca usar el object signature `toast({ type: 'success', text: '...' })` si los shorcuts aplican. Usa **`toast.success(...)`**.

---

*Regla de Oro: Si ves una clase `bg-orange-500` en el código, existe Deuda Técnica (DEBT-UI). Refactorízala a `bg-brand-500` o, preferiblemente, al componente Primitive pertinente.*
