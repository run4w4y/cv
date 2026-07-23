import { describe, expect, test } from 'bun:test'

import {
  colorSchemeDataAttribute,
  colorSchemeStorageKey,
  darkColorSchemeClassName,
  legacyThemeStorageKey,
} from './index'
import { createColorSchemeBootScript } from './script'

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return Array.from(this.values.keys()).at(index) ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

describe('color-scheme boot script', () => {
  test('parses and migrates legacy storage', () => {
    const classes = new Set<string>()
    const storage = new MemoryStorage()
    const root = {
      classList: {
        toggle: (name: string, force?: boolean) => {
          if (force) {
            classes.add(name)
          } else {
            classes.delete(name)
          }
          return force ?? false
        },
      },
      dataset: {} as DOMStringMap,
    }
    const document = { documentElement: root }
    const window = {
      localStorage: storage,
      matchMedia: () => ({ matches: true }),
    }
    storage.setItem(legacyThemeStorageKey, 'system')

    new Function('document', 'window', createColorSchemeBootScript())(
      document,
      window
    )

    expect(storage.getItem(colorSchemeStorageKey)).toBe('system')
    expect(storage.getItem(legacyThemeStorageKey)).toBeNull()
    expect(classes.has(darkColorSchemeClassName)).toBe(true)
    expect(root.dataset[colorSchemeDataAttribute]).toBe('system')
  })
})
