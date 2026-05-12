/**
 * HabitaPlan Design System — punto de entrada único
 * Importar desde aquí en lugar de desde src/components/ui directamente.
 *
 * import { Button, ToggleChip, useToast } from '@/design-system'
 */

// Componentes base
export { Button, buttonVariants } from '@/components/ui/button'
export { Input } from '@/components/ui/input'
export { Card } from '@/components/ui/card'
export { Avatar } from '@/components/ui/avatar'
export { Dropdown } from '@/components/ui/dropdown'
export { Modal, type ModalProps } from '@/components/ui/modal'
export { ActionCard, type ActionCardProps } from '@/components/ui/action-card'
export { SmartLink, type SmartLinkProps } from '@/components/ui/smart-link'
export { ToggleChip, type ToggleChipProps } from '@/components/ui/toggle-chip'
export { Skeleton } from '@/components/ui/skeleton'
export { EmptyState } from '@/components/ui/empty-state'
export { Icon } from '@/components/ui/icon'
export { Container } from '@/components/ui/container'
export { ThemeToggle } from '@/components/ui/ThemeToggle'
export { StarRating } from '@/components/StarRating'

// Feedback
export { ToastProvider, useToast, type ToastType, type ToastItem, type ToastAPI } from '@/components/ui/toast'

// Layout
export { Header } from '@/components/layout/Header'
export { Footer } from '@/components/layout/Footer'
export { MobileNav } from '@/components/layout/MobileNav'
export { CitySwitcher } from '@/components/layout/CitySwitcher'
export { UserMenu } from '@/components/layout/UserMenu'

// Hooks DS
export { useTheme } from '@/hooks/useTheme'

// Tokens
export * from './tokens'
