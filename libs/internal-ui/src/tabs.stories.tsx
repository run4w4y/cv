import type { Meta, StoryObj } from '@storybook/react-vite'

import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'

const meta = {
  title: 'Navigation/Tabs',
  component: Tabs,
  tags: ['autodocs'],
} satisfies Meta<typeof Tabs>

export default meta
type Story = StoryObj<typeof meta>

export const ApplicationDetails: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="w-xl">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="timeline">Timeline</TabsTrigger>
        <TabsTrigger value="notes">Notes</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <div className="rounded-md border border-border bg-card p-4 text-sm">
          Role, company, status, and listing metadata.
        </div>
      </TabsContent>
      <TabsContent value="timeline">
        <div className="rounded-md border border-border bg-card p-4 text-sm">
          Application events and status transitions.
        </div>
      </TabsContent>
      <TabsContent value="notes">
        <div className="rounded-md border border-border bg-card p-4 text-sm">
          Private management notes.
        </div>
      </TabsContent>
    </Tabs>
  ),
}
