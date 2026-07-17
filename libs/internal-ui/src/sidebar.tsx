import { cva, type VariantProps } from 'class-variance-authority'
import { PanelLeft } from 'lucide-react'
import * as React from 'react'

import { Button, type ButtonProps } from './button'
import { cn } from './utils'

type SidebarContextValue = {
  readonly open: boolean
  readonly setOpen: React.Dispatch<React.SetStateAction<boolean>>
}

const SidebarContext = React.createContext<SidebarContextValue | undefined>(
  undefined
)

export const useSidebar = () => {
  const context = React.useContext(SidebarContext)
  if (context === undefined) {
    throw new Error('useSidebar must be used within SidebarProvider.')
  }
  return context
}

export type SidebarProviderProps = React.ComponentProps<'div'> & {
  readonly defaultOpen?: boolean
}

export const SidebarProvider = ({
  defaultOpen = false,
  className,
  ...props
}: SidebarProviderProps) => {
  const [open, setOpen] = React.useState(defaultOpen)
  const value = React.useMemo(() => ({ open, setOpen }), [open])

  return (
    <SidebarContext.Provider value={value}>
      <div
        data-slot="sidebar-provider"
        className={cn(
          'isolate flex h-dvh min-h-0 w-full overflow-hidden bg-background text-foreground',
          className
        )}
        {...props}
      />
    </SidebarContext.Provider>
  )
}

export const Sidebar = ({
  className,
  ...props
}: React.ComponentProps<'aside'>) => {
  const { open, setOpen } = useSidebar()

  return (
    <>
      <aside
        data-slot="sidebar"
        data-open={open ? 'true' : 'false'}
        className={cn(
          'fixed inset-y-0 left-0 z-20 flex w-64 -translate-x-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform data-[open=true]:translate-x-0 lg:sticky lg:translate-x-0',
          className
        )}
        {...props}
      />
      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-10 cursor-default bg-slate-950/30 backdrop-blur-xs lg:hidden"
        />
      ) : null}
    </>
  )
}

export const SidebarHeader = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    data-slot="sidebar-header"
    className={cn('flex shrink-0 flex-col gap-2 p-3', className)}
    {...props}
  />
)

export const SidebarContent = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    data-slot="sidebar-content"
    className={cn(
      'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3',
      className
    )}
    {...props}
  />
)

export const SidebarFooter = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    data-slot="sidebar-footer"
    className={cn('flex shrink-0 flex-col gap-2 p-3', className)}
    {...props}
  />
)

export const SidebarInset = ({
  className,
  ...props
}: React.ComponentProps<'main'>) => (
  <main
    data-slot="sidebar-inset"
    className={cn(
      'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
      className
    )}
    {...props}
  />
)

export const SidebarTrigger = ({
  className,
  children,
  onClick,
  ...props
}: ButtonProps) => {
  const { setOpen } = useSidebar()
  return (
    <Button
      data-slot="sidebar-trigger"
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Open navigation"
      className={className}
      {...props}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) setOpen(true)
      }}
    >
      {children ?? <PanelLeft />}
    </Button>
  )
}

export const SidebarSeparator = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    data-slot="sidebar-separator"
    className={cn('h-px shrink-0 bg-sidebar-border', className)}
    {...props}
  />
)

export const SidebarGroup = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    data-slot="sidebar-group"
    className={cn('flex min-w-0 flex-col gap-1', className)}
    {...props}
  />
)

export const SidebarGroupLabel = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    data-slot="sidebar-group-label"
    className={cn(
      'px-2 py-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase',
      className
    )}
    {...props}
  />
)

export const SidebarMenu = ({
  className,
  ...props
}: React.ComponentProps<'ul'>) => (
  <ul
    data-slot="sidebar-menu"
    className={cn('flex min-w-0 flex-col gap-1', className)}
    {...props}
  />
)

export const SidebarMenuItem = ({
  className,
  ...props
}: React.ComponentProps<'li'>) => (
  <li
    data-slot="sidebar-menu-item"
    className={cn('relative', className)}
    {...props}
  />
)

export const sidebarMenuButtonVariants = cva(
  'flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-primary [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      active: {
        true: 'bg-sidebar-accent text-sidebar-accent-foreground',
        false: '',
      },
    },
    defaultVariants: { active: false },
  }
)

export const SidebarMenuButton = ({
  className,
  active,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof sidebarMenuButtonVariants>) => (
  <button
    data-slot="sidebar-menu-button"
    data-active={active ? 'true' : 'false'}
    className={cn(sidebarMenuButtonVariants({ active, className }))}
    {...props}
  />
)
