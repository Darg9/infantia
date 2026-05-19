import type { Preview } from "@storybook/react"
import { withThemeByClassName } from "@storybook/addon-themes"
import { ToastProvider } from "../src/components/ui"
// eslint-disable-next-line no-restricted-imports -- Storybook necesita globals.css directamente para renderizar el DS correctamente
import "../src/app/globals.css"
import React from "react"

const preview: Preview = {
  parameters: {
    layout: "centered",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    // Dark mode via clase .dark en <html> — compatible con Anti-FOT del DS
    withThemeByClassName({
      themes: { Claro: "", Oscuro: "dark" },
      defaultTheme: "Claro",
      parentSelector: "html",
    }),
    // ToastProvider global — cualquier story puede usar useToast()
    (Story) => React.createElement(ToastProvider, null, React.createElement(Story)),
  ],
}

export default preview
