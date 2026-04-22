import type { Meta, StoryObj } from '@storybook/react'
import { Card } from './card'

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  render: (args) => (
    <Card {...args} className="w-[350px]">
      <Card.Header 
        title="Crear Proyecto" 
        description="Escribe los datos básicos de tu nuevo proyecto. Esto lo guardará en el catálogo general."
      />
      <Card.Body>
        <div className="flex flex-col space-y-1.5 h-20 justify-center items-center bg-gray-50 dark:bg-gray-800 rounded-md">
          {/* Mock Content */}
          <span className="text-sm text-gray-500">Contenido Dinámico</span>
        </div>
      </Card.Body>
      <Card.Footer>
        <Button className="bg-hp-action-primary text-white w-full py-2 rounded-lg font-medium text-sm hover:opacity-90">
          Guardar
        </Button>
      </Card.Footer>
    </Card>
  )
}

export default meta
type Story = StoryObj<typeof Card>

export const Default: Story = {
  args: {
    variant: 'default'
  }
}

export const Flat: Story = {
  args: {
    variant: 'flat'
  }
}

export const Elevated: Story = {
  args: {
    variant: 'elevated'
  }
}
