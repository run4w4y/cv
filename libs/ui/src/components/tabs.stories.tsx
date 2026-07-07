import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'

const meta = {
  title: 'Components/Tabs',
  component: Tabs,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Tabs compose Base UI root, list, trigger, and content primitives with default and line list variants.',
      },
    },
  },
} satisfies Meta<typeof Tabs>

export default meta

type Story = StoryObj<typeof meta>

type PanelProps = {
  children: ReactNode
}

const Panel = ({ children }: PanelProps) => (
  <div className="max-w-md rounded-lg border border-border bg-background p-4 leading-6">
    {children}
  </div>
)

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="summary" className="w-[28rem]">
      <TabsList>
        <TabsTrigger value="summary">Summary</TabsTrigger>
        <TabsTrigger value="experience">Experience</TabsTrigger>
        <TabsTrigger value="skills">Skills</TabsTrigger>
      </TabsList>
      <TabsContent value="summary">
        <Panel>
          Focused profile summary with the most relevant role signal.
        </Panel>
      </TabsContent>
      <TabsContent value="experience">
        <Panel>Recent roles, ownership, and delivery context.</Panel>
      </TabsContent>
      <TabsContent value="skills">
        <Panel>Tooling, product surface, and platform strengths.</Panel>
      </TabsContent>
    </Tabs>
  ),
}

export const LineVariant: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="w-[28rem]">
      <TabsList variant="line">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="notes">Notes</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <Panel>
          Line tabs are useful when the container already has structure.
        </Panel>
      </TabsContent>
      <TabsContent value="details">
        <Panel>
          Details stay visually quiet while retaining a clear active marker.
        </Panel>
      </TabsContent>
      <TabsContent value="notes">
        <Panel>
          Notes can hold supporting information without changing layout.
        </Panel>
      </TabsContent>
    </Tabs>
  ),
}

export const Vertical: Story = {
  render: () => (
    <Tabs
      defaultValue="one"
      orientation="vertical"
      className="w-[32rem] flex-row"
    >
      <TabsList variant="line">
        <TabsTrigger value="one">Profile</TabsTrigger>
        <TabsTrigger value="two">Timeline</TabsTrigger>
        <TabsTrigger value="three">Output</TabsTrigger>
      </TabsList>
      <TabsContent value="one">
        <Panel>
          Vertical tabs support compact side navigation inside dense tools.
        </Panel>
      </TabsContent>
      <TabsContent value="two">
        <Panel>
          Timeline views keep related panels available without a page jump.
        </Panel>
      </TabsContent>
      <TabsContent value="three">
        <Panel>
          Output panels work well for previews and generated artifacts.
        </Panel>
      </TabsContent>
    </Tabs>
  ),
}
