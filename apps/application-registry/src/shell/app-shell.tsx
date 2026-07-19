import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  cn,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  sidebarMenuButtonVariants,
  useSidebar,
} from '@cv/internal-ui'
import {
  Activity,
  ChartNoAxesCombined,
  Braces,
  BriefcaseBusiness,
  Database,
  GitBranch,
} from 'lucide-react'
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7'
import * as React from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'

import { HeaderActionsProvider } from './header-actions'

const navItems = [
  { to: '/applications', label: 'Applications', icon: BriefcaseBusiness },
  { to: '/preparation/batch', label: 'URL workflows', icon: GitBranch },
  { to: '/events', label: 'Events', icon: Activity },
  { to: '/analytics', label: 'CV analytics', icon: ChartNoAxesCombined },
  { to: '/schema/cv-document', label: 'CV schema', icon: Braces },
] as const

const routeTitle = (pathname: string) => {
  if (pathname === '/schema/cv-document') return 'CV schema'
  if (pathname === '/preparation/batch') return 'URL workflows'
  if (pathname.startsWith('/events')) return 'Events'
  if (pathname.startsWith('/analytics')) return 'CV analytics'
  if (/^\/applications\/[^/]+\/prepare$/u.test(pathname)) {
    return 'Prepare tailored CV'
  }
  if (/^\/applications\/[^/]+\/cover-letter$/u.test(pathname)) {
    return 'Prepare cover letter'
  }
  if (/^\/applications\/[^/]+/u.test(pathname)) return 'Application details'
  return 'Applications'
}

const ShellNavigation = () => {
  const { setOpen } = useSidebar()

  return (
    <Sidebar>
      <SidebarHeader className="h-16 justify-center px-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Database className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Registry</p>
            <p className="truncate text-xs text-muted-foreground">
              Internal workspace
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />
      <SidebarContent className="px-2 py-4">
        <nav aria-label="Main navigation">
          <SidebarGroup>
            <SidebarGroupLabel>Manage</SidebarGroupLabel>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      cn(sidebarMenuButtonVariants({ active: isActive }))
                    }
                  >
                    <item.icon />
                    {item.label}
                  </NavLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </nav>
      </SidebarContent>
    </Sidebar>
  )
}

const AppShellContent = () => {
  const { pathname } = useLocation()
  const [actionsTarget, setActionsTarget] =
    React.useState<HTMLDivElement | null>(null)
  const title = routeTitle(pathname)

  return (
    <>
      <ShellNavigation />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger className="lg:hidden" />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                Application Registry
              </p>
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <span>Registry</span>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{title}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </div>
          <div
            ref={setActionsTarget}
            className="flex shrink-0 items-center gap-2"
          />
        </header>
        <HeaderActionsProvider target={actionsTarget}>
          <NuqsAdapter>
            <div className="flex min-h-0 flex-1 overflow-hidden bg-background">
              <Outlet />
            </div>
          </NuqsAdapter>
        </HeaderActionsProvider>
      </SidebarInset>
    </>
  )
}

export const AppShell = () => (
  <SidebarProvider>
    <AppShellContent />
  </SidebarProvider>
)
