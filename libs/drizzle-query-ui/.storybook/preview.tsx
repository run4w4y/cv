import type { Preview } from '@storybook/react-vite'
import { type ReactNode, useEffect } from 'react'

import './preview.css'

type ThemeDecoratorProps = {
  readonly children: ReactNode
  readonly theme: 'light' | 'dark'
}

const ThemeDecorator = ({ children, theme }: ThemeDecoratorProps) => {
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme

    return () => {
      document.documentElement.classList.remove('dark')
      document.documentElement.style.removeProperty('color-scheme')
    }
  }, [theme])

  return <div className="storybook-canvas">{children}</div>
}

const preview: Preview = {
  decorators: [
    (Story, context) => (
      <ThemeDecorator theme={context.globals.theme ?? 'light'}>
        <Story />
      </ThemeDecorator>
    ),
  ],
  globalTypes: {
    theme: {
      description: 'Management UI color scheme',
      defaultValue: 'light',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
      },
    },
  },
  parameters: {
    controls: {
      expanded: true,
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    docs: {
      toc: true,
    },
    layout: 'centered',
  },
}

export default preview
