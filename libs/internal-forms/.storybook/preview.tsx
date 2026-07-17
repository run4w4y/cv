import { TooltipProvider } from '@cv/internal-ui'
import type { Preview } from '@storybook/react-vite'

import './preview.css'

const preview: Preview = {
  decorators: [
    (Story) => (
      <TooltipProvider delay={0}>
        <div className="min-h-40 bg-background p-8 text-foreground">
          <Story />
        </div>
      </TooltipProvider>
    ),
  ],
  parameters: {
    controls: { expanded: true },
    docs: { toc: true },
    layout: 'centered',
  },
}

export default preview
