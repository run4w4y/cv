import * as React from 'react'

export type TableDensity = 'compact' | 'comfortable' | 'spacious'

export interface SavedView<State> {
  readonly id: string
  readonly name: string
  readonly state: State
  readonly createdAt: string
  readonly updatedAt: string
}

export interface SavedViewsStorage {
  readonly getItem: (key: string) => string | null
  readonly setItem: (key: string, value: string) => void
}

export const defaultSavedViewsStorage = (): SavedViewsStorage | null =>
  typeof window === 'undefined' ? null : window.localStorage

export const usePersistentSavedViews = <State>({
  storage,
  storageKey,
  load,
  persist,
}: {
  readonly storage: SavedViewsStorage | null
  readonly storageKey: string
  readonly load: (
    storage: SavedViewsStorage | null,
    storageKey: string
  ) => readonly SavedView<State>[]
  readonly persist: (
    storage: SavedViewsStorage | null,
    views: readonly SavedView<State>[],
    storageKey: string
  ) => void
}) => {
  const [views, setViews] = React.useState<readonly SavedView<State>[]>(() =>
    load(storage, storageKey)
  )

  // Storage is an external persistence boundary.
  React.useEffect(() => {
    persist(storage, views, storageKey)
  }, [persist, storage, storageKey, views])

  // Keep separate tabs consistent without putting browser events in domain UI.
  React.useEffect(() => {
    if (typeof window === 'undefined' || storage !== window.localStorage) return
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return
      const incoming = load(storage, storageKey)
      setViews((current) =>
        JSON.stringify(current) === JSON.stringify(incoming)
          ? current
          : incoming
      )
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [load, storage, storageKey])

  return [views, setViews] as const
}

export type SavedViewCopy = {
  readonly restoreDescription: string
  readonly emptyDescription: string
  readonly createDescription: string
  readonly renameDescription: string
  readonly placeholder: string
}
