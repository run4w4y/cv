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
  BriefcaseBusiness,
  ChartNoAxesCombined,
  Database,
  GitBranch,
  Settings2,
} from 'lucide-react'
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7'
import * as React from 'react'
import { Link, NavLink, Outlet, useMatches } from 'react-router'
import { isDesktopHost } from '@/host/desktop'
import { RegistryConnectionControl } from '@/host/registry-connection-dialog'
import { isRegistryRouteHandle, useRegistryDocumentTitle } from './breadcrumbs'
import { HeaderActionsProvider } from './header-actions'

const navItems = [
  { to: '/applications', label: 'Applications', icon: BriefcaseBusiness },
  { to: '/ai-workflows', label: 'AI workflows', icon: GitBranch },
  { to: '/activities', label: 'Activities', icon: Activity },
  { to: '/analytics', label: 'CV analytics', icon: ChartNoAxesCombined },
  { to: '/facts', label: 'Reviewed facts', icon: Database },
  {
    to: '/preparation/cv-guidance',
    label: 'CV guidance',
    icon: Settings2,
  },
] as const

const ShellNavigation = () => {
  const { setOpen } = useSidebar()

  return (
    <Sidebar>
      <SidebarHeader className="h-16 justify-center px-2">
        <RegistryConnectionControl />
      </SidebarHeader>

      <SidebarSeparator />
      <SidebarContent className="px-2 py-4">
        <nav aria-label="Main navigation">
          <SidebarGroup>
            <SidebarGroupLabel>Manage</SidebarGroupLabel>
            <SidebarMenu>
              {navItems
                .filter(
                  (item) => item.to !== '/ai-workflows' || isDesktopHost()
                )
                .map((item) => (
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
  const matches = useMatches()
  const [actionsTarget, setActionsTarget] =
    React.useState<HTMLDivElement | null>(null)
  const handledMatches = matches.filter((match) =>
    isRegistryRouteHandle(match.handle)
  )
  const breadcrumbs = handledMatches.flatMap((match) =>
    isRegistryRouteHandle(match.handle) ? match.handle.breadcrumbs(match) : []
  )
  const lastBreadcrumb = breadcrumbs.at(-1)
  const titleManagedByRoute = handledMatches.some(
    (match) =>
      isRegistryRouteHandle(match.handle) &&
      match.handle.managesDocumentTitle === true
  )
  useRegistryDocumentTitle(
    titleManagedByRoute
      ? null
      : typeof lastBreadcrumb?.label === 'string'
        ? lastBreadcrumb.label
        : 'Applications'
  )

  return (
    <>
      <ShellNavigation />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger className="lg:hidden" />
            <div className="min-w-0">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <Link
                      to="/applications"
                      className="transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      Registry
                    </Link>
                  </BreadcrumbItem>
                  {breadcrumbs.flatMap((breadcrumb, index) => [
                    <BreadcrumbSeparator key={`${breadcrumb.key}-separator`} />,
                    <BreadcrumbItem key={breadcrumb.key}>
                      {index === breadcrumbs.length - 1 ||
                      breadcrumb.to === undefined ? (
                        <BreadcrumbPage>{breadcrumb.label}</BreadcrumbPage>
                      ) : (
                        <Link
                          to={breadcrumb.to}
                          className="max-w-56 truncate transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          {breadcrumb.label}
                        </Link>
                      )}
                    </BreadcrumbItem>,
                  ])}
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
