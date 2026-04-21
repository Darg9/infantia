/**
 * Card — HabitaPlan Design System
 *
 * Contenedor estándar de sección con bordes, radio y padding consistentes.
 *
 * Variantes:
 *   default  — fondo blanco / dark:gray-900, borde sutil
 *   flat     — sin sombra, solo borde (para listas)
 *   elevated — con sombra-md (para modales / highlighted content)
 *
 * Uso:
 *   <Card>
 *     <Card.Header title="Información básica" description="Tu nombre..." />
 *     <Card.Body>...</Card.Body>
 *     <Card.Footer>...</Card.Footer>
 *   </Card>
 */

import { clsx } from 'clsx'

type CardVariant = 'default' | 'flat' | 'elevated'

interface CardProps {
  variant?: CardVariant
  className?: string
  children: React.ReactNode
  /** Accesibilidad: id del heading que labela esta sección */
  'aria-labelledby'?: string
}

const CARD_VARIANTS: Record<CardVariant, string> = {
  default:  'bg-hp-bg-surface border border-hp-border-subtle',
  flat:     'bg-hp-bg-surface border border-hp-border-subtle',
  elevated: 'bg-hp-bg-surface border border-hp-border-subtle shadow-md',
}

export function Card({ variant = 'default', className, children, ...props }: CardProps) {
  return (
    <div
      className={clsx('rounded-2xl p-6 sm:p-8', CARD_VARIANTS[variant], className)}
      {...props}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: string
  description?: string
  className?: string
  /** id asignado al h2, para aria-labelledby en <Card> */
  id?: string
}

function CardHeader({ title, description, className, id }: CardHeaderProps) {
  return (
    <div className={clsx('mb-6', className)}>
      <h2
        id={id}
        className="text-base font-semibold text-hp-text-primary"
      >
        {title}
      </h2>
      {description && (
        <p className="text-sm text-hp-text-secondary mt-1">{description}</p>
      )}
    </div>
  )
}

interface CardBodyProps {
  className?: string
  children: React.ReactNode
}

function CardBody({ children, className }: CardBodyProps) {
  return <div className={clsx('space-y-6', className)}>{children}</div>
}

interface CardFooterProps {
  className?: string
  children: React.ReactNode
}

function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div
      className={clsx(
        'flex items-center justify-end pt-4 mt-4',
        'border-t border-hp-border-subtle',
        className
      )}
    >
      {children}
    </div>
  )
}

Card.Header = CardHeader
Card.Body = CardBody
Card.Footer = CardFooter
