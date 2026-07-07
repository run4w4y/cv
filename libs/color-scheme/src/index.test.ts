import { describe, expect, test } from 'bun:test'
import {
  applyColorSchemePreference,
  type ColorSchemeRoot,
  type ColorSchemeStorage,
  colorSchemeDataAttribute,
  colorSchemeStorageKey,
  legacyThemeStorageKey,
  legacyVersionedThemeStorageKey,
  readColorSchemePreference,
  resolveColorSchemePreference,
  writeColorSchemePreference,
} from './index'

class MemoryStorage implements ColorSchemeStorage {
  readonly values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

const createColorSchemeRoot = () => {
  const classes = new Set<string>()
  const root: ColorSchemeRoot = {
    classList: {
      toggle: (name: string, force?: boolean) => {
        const shouldAdd = force ?? !classes.has(name)

        if (shouldAdd) {
          classes.add(name)
        } else {
          classes.delete(name)
        }

        return shouldAdd
      },
    },
    dataset: {},
  }

  return { classes, root }
}

describe('color-scheme runtime', () => {
  test('reads the versioned storage key', () => {
    const storage = new MemoryStorage()

    storage.setItem(colorSchemeStorageKey, 'dark')

    expect(readColorSchemePreference(storage)).toBe('dark')
  })

  test('migrates the old versioned theme storage key', () => {
    const storage = new MemoryStorage()

    storage.setItem(legacyVersionedThemeStorageKey, 'system')

    expect(readColorSchemePreference(storage)).toBe('system')
    expect(storage.getItem(colorSchemeStorageKey)).toBe('system')
    expect(storage.getItem(legacyVersionedThemeStorageKey)).toBeNull()
  })

  test('migrates the legacy bare theme storage key', () => {
    const storage = new MemoryStorage()

    storage.setItem(legacyThemeStorageKey, 'light')

    expect(readColorSchemePreference(storage)).toBe('light')
    expect(storage.getItem(colorSchemeStorageKey)).toBe('light')
    expect(storage.getItem(legacyThemeStorageKey)).toBeNull()
  })

  test('stores only the color-scheme storage key', () => {
    const storage = new MemoryStorage()

    storage.setItem(legacyThemeStorageKey, 'dark')
    storage.setItem(legacyVersionedThemeStorageKey, 'dark')
    writeColorSchemePreference('system', storage)

    expect(storage.getItem(colorSchemeStorageKey)).toBe('system')
    expect(storage.getItem(legacyThemeStorageKey)).toBeNull()
    expect(storage.getItem(legacyVersionedThemeStorageKey)).toBeNull()
  })

  test('resolves system preference from the media query result', () => {
    expect(resolveColorSchemePreference('system', true)).toBe('dark')
    expect(resolveColorSchemePreference('system', false)).toBe('light')
  })

  test('applies the dark class and selected preference dataset', () => {
    const { classes, root } = createColorSchemeRoot()

    applyColorSchemePreference('system', { prefersDark: true, root })

    expect(classes.has('dark')).toBe(true)
    expect(root.dataset[colorSchemeDataAttribute]).toBe('system')

    applyColorSchemePreference('light', { prefersDark: true, root })

    expect(classes.has('dark')).toBe(false)
    expect(root.dataset[colorSchemeDataAttribute]).toBe('light')
  })
})
