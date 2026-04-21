import type { Preview } from '@storybook/nextjs-vite'
import React from 'react'
import { withThemeByClassName } from '@storybook/addon-themes'
import '../src/app/globals.css'

export const parameters = {
  layout: 'centered',
  viewport: { defaultViewport: 'mobile' },
  chromatic: { 
    disableSnapshot: false,
    pauseAnimationAtEnd: true 
  },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/i,
    },
  },
}

export const decorators = [
  withThemeByClassName({
    themes: {
      light: '',
      dark: 'dark',
    },
    defaultTheme: 'light',
  }),
  (Story) => (
    <div className="font-sans antialiased text-hp-text-primary bg-hp-bg-page w-full min-h-[400px] flex items-center justify-center p-4">
      <Story />
    </div>
  ),
]

const preview: Preview = {
  parameters,
  decorators,
}

export default preview