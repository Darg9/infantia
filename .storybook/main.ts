import type { StorybookConfig } from "@storybook/react-vite"
import path from "path"

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
    "@storybook/addon-themes",
    "storybook-addon-pseudo-states",
    "@chromatic-com/storybook",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  async viteFinal(config) {
    config.resolve = config.resolve ?? {}
    config.resolve.alias = {
      ...(config.resolve.alias as Record<string, string>),
      "@": path.resolve(__dirname, "../src"),
      "next/link":  path.resolve(__dirname, "./__mocks__/next-link.tsx"),
      "next/image": path.resolve(__dirname, "./__mocks__/next-image.tsx"),
    }
    config.css = {
      postcss: {
        plugins: [(await import("@tailwindcss/postcss")).default],
      },
    }
    return config
  },
}

export default config
