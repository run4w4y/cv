import { TooltipProvider } from '@cv/internal-ui'
import { RegistryProvider } from '@effect/atom-react'
import type { Preview } from '@storybook/react-vite'
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'

import './preview.css'

const ManagementCanvas = ({ children }: { readonly children: ReactNode }) => (
  <MemoryRouter>
    <RegistryProvider>
      <NuqsAdapter>
        <TooltipProvider delay={0}>
          <div className="storybook-canvas">{children}</div>
        </TooltipProvider>
      </NuqsAdapter>
    </RegistryProvider>
  </MemoryRouter>
)

const preview: Preview = {
  decorators: [
    (Story) => (
      <ManagementCanvas>
        <Story />
      </ManagementCanvas>
    ),
  ],
  parameters: {
    controls: { expanded: true },
    docs: { toc: true },
    layout: 'centered',
  },
}

export default preview
