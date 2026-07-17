import type { Meta, StoryObj } from '@storybook/react-vite'
import { BriefcaseBusiness, LayoutDashboard, Settings } from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from './sidebar'

const meta = {
  title: 'Navigation/Sidebar',
  component: SidebarProvider,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof SidebarProvider>

export default meta
type Story = StoryObj<typeof meta>

export const RegistryShell: Story = {
  render: () => (
    <SidebarProvider defaultOpen>
      <Sidebar>
        <SidebarHeader>
          <div className="px-3 py-2">
            <p className="font-semibold text-sidebar-foreground">
              Application registry
            </p>
            <p className="text-xs text-muted-foreground">Internal management</p>
          </div>
          <SidebarSeparator />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <LayoutDashboard />
                  Dashboard
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton active>
                  <BriefcaseBusiness />
                  Applications
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <Settings />
                Settings
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4">
          <SidebarTrigger className="lg:hidden" />
          <h1 className="font-semibold">Applications</h1>
        </header>
        <div className="flex-1 p-6">
          <div className="h-full rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            Registry content
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  ),
}
