import type { Meta, StoryObj } from '@storybook/react'
import { Input } from './input'

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  parameters: {
    layout: 'centered',
  },
  args: {
    id: 'email-input',
    label: 'Correo Electrónico',
    placeholder: 'Ingresa tu correo',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof Input>

export const Default: Story = {}

export const WithHint: Story = {
  args: {
    hint: 'No compartiremos tu correo con nadie más.',
  },
}

export const WithError: Story = {
  args: {
    error: 'Formato de correo inválido',
  },
}

export const Required: Story = {
  args: {
    required: true,
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
    value: 'deshabilitado@ejemplo.com',
  },
}

export const HiddenLabel: Story = {
  args: {
    hideLabel: true,
  },
}
