# HabitaPlan Design System

Plataforma de descubrimiento de actividades y eventos para familias. Naranja (#ff8c00) + azul marino (#002147). Next.js 16 + TypeScript + Tailwind v4. Soporte dark mode.

---

## Tokens principales

| Token | Valor | Uso |
|-------|-------|-----|
| `brand-500` | `#ff8c00` | Naranja HabitaPlan — acción principal |
| `brand-600` | `#e67e00` | Hover / estado activo (ToggleChip) |
| `--hp-primary` | `#002147` | Azul marino — texto principal |
| `--hp-bg-page` | `#f8fafc` | Canvas (slate-50) |
| `--hp-bg-surface` | `#ffffff` | Cards y modales |
| `--hp-border` | `rgba(0,33,71,0.1)` | Bordes sutiles |

Fuente de verdad: `src/app/globals.css` (`@theme` + `:root`).
**Regla:** nunca hardcodear hex en componentes — usar clases Tailwind o `var(--hp-*)`.

---

## Componentes

### Button
Variantes: `primary` (naranja sólido) · `secondary` (outline) · `ghost` (texto) · `destructive` (rojo).
Tamaños: `sm` · `md` (default) · `lg` · `icon`.

```tsx
<Button variant="primary" size="md">Explorar actividades</Button>
<Button variant="secondary" loading>Guardando...</Button>
```

### ToggleChip
Botón de selección toggle para grupos de opciones. **Un solo componente para todos los filtros.**
Variantes: `pill` (rounded-full, chips horizontales) · `tile` (rounded-xl, grids).

```tsx
<ToggleChip variant="pill" pressed={activo} onClick={toggle}>Hoy</ToggleChip>
<ToggleChip variant="tile" pressed={activo} fullWidth>4–6 años</ToggleChip>
```

Estado activo: `border-brand-500 bg-brand-600 text-white`.

### useToast — SSOT de feedback
**Único método permitido para mostrar notificaciones.** ESLint bloquea `alert()` y `prompt()`.

```tsx
const { toast } = useToast()
toast({ type: 'success', message: 'Actividad guardada' })
toast({ type: 'error',   message: 'Error al guardar' })
```

### Modal
```tsx
<Modal open={open} onClose={() => setOpen(false)} title="Confirmar">
  Contenido del modal
</Modal>
```

### Card
Superficie elevada con sombra y borde sutil.

### Input
Campo de texto estándar con soporte para label, error y helper text.

### CitySwitcher
Selector de ciudad activa. Filtra ciudades con ≥1 actividad ACTIVE.

### SmartLink
Link inteligente: interno usa `next/link`, externo abre en nueva pestaña con rel seguro.

---

## Estructura de carpetas

```
src/
├── design-system/
│   ├── index.ts      ← importar desde aquí
│   ├── tokens.ts     ← constantes de color/tipografía/radius
│   └── README.md     ← esta guía
├── components/
│   ├── ui/           ← implementación de componentes base
│   └── layout/       ← Header, Footer, MobileNav, CitySwitcher
└── app/
    └── globals.css   ← @theme tokens Tailwind v4
```

**Importar así:**
```tsx
import { Button, ToggleChip, useToast, colors } from '@/design-system'
```

---

## Reglas del sistema

1. **Feedback → solo `useToast()`** — ESLint bloquea `alert()`/`prompt()`
2. **Toggles → solo `ToggleChip`** — no duplicar clases inline
3. **Colores → solo tokens** — no hardcodear hex
4. **Links → solo `SmartLink`** — maneja interno/externo automáticamente
5. **Botones → variante correcta** — máximo 1 `primary` por sección visible
