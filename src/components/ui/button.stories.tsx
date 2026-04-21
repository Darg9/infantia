import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './button'

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof Button>

export const Primary: Story = {
  args: {
    children: 'Acción Principal',
    variant: 'primary',
  },
}

export const Secondary: Story = {
  args: {
    children: 'Acción Secundaria',
    variant: 'secondary',
  },
}

export const Ghost: Story = {
  args: {
    children: 'Botón Fantasma',
    variant: 'ghost',
  },
}

export const Destructive: Story = {
  args: {
    children: 'Eliminar cuenta',
    variant: 'destructive',
  },
}

export const Disabled: Story = {
  args: {
    children: 'No disponible',
    variant: 'primary',
    disabled: true,
  },
}

export const Loading: Story = {
  args: {
    children: 'Cargando...',
    variant: 'primary',
    loading: true,
  },
  parameters: {
    chromatic: { disableSnapshot: true },
  },
}

export const Hover: Story = {
  args: {
    children: 'Hover Principal',
    variant: 'primary',
  },
  parameters: {
    pseudo: { hover: true },
  },
}
