import babel from '@rolldown/plugin-babel'
import type { StorybookConfig } from '@storybook/react-vite'
import tailwindcss from '@tailwindcss/vite'
import { reactCompilerPreset } from '@vitejs/plugin-react'
import { mergeConfig } from 'vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx|mdx)'],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  viteFinal: async (viteConfig) => {
    const plugins = viteConfig.plugins?.filter(
      (plugin) =>
        plugin === null ||
        plugin === false ||
        Array.isArray(plugin) ||
        plugin.name !== 'application-registry-content-security-policy'
    )
    return mergeConfig(
      {
        ...viteConfig,
        plugins,
      },
      {
        plugins: [babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
      }
    )
  },
}

export default config
