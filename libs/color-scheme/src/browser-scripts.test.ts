import { afterEach, describe, expect, test } from 'bun:test'
import {
  createColorSchemeBootScript,
  createColorSchemeRuntimeScript,
} from './astro'
import {
  colorSchemeDataAttribute,
  colorSchemeStorageKey,
  colorSchemeValueAttribute,
  darkColorSchemeClassName,
  legacyThemeStorageKey,
} from './index'

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

class FakeEvent {
  constructor(readonly type: string) {}
}

class FakeElement {
  readonly attributes = new Map<string, string>()

  constructor(attributes: Record<string, string> = {}) {
    Object.entries(attributes).forEach(([key, value]) =>
      this.attributes.set(key, value)
    )
  }

  closest(selector: string) {
    return this.matches(selector) ? this : null
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null
  }

  matches(selector: string) {
    return selector === `[${colorSchemeValueAttribute}]`
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value)
  }
}

type Listener = (event: { target?: unknown; type: string }) => void

const originalGlobals = {
  document: globalThis.document,
  Element: globalThis.Element,
  Event: globalThis.Event,
  localStorage: globalThis.localStorage,
  matchMedia: globalThis.matchMedia,
  window: globalThis.window,
}

const createBrowserHarness = () => {
  const classes = new Set<string>()
  const storage = new MemoryStorage()
  const controls: FakeElement[] = []
  const documentListeners = new Map<string, Set<Listener>>()
  const windowListeners = new Map<string, Set<Listener>>()
  const mediaListeners = new Set<Listener>()
  const root = {
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
    dataset: {} as DOMStringMap,
  }
  const addListener = (
    listeners: Map<string, Set<Listener>>,
    type: string,
    listener: Listener
  ) => {
    const listenersForType = listeners.get(type) ?? new Set<Listener>()
    listenersForType.add(listener)
    listeners.set(type, listenersForType)
  }
  const removeListener = (
    listeners: Map<string, Set<Listener>>,
    type: string,
    listener: Listener
  ) => {
    listeners.get(type)?.delete(listener)
  }
  const mediaQueryList = {
    addEventListener: (type: string, listener: Listener) => {
      if (type === 'change') {
        mediaListeners.add(listener)
      }
    },
    matches: true,
    removeEventListener: (type: string, listener: Listener) => {
      if (type === 'change') {
        mediaListeners.delete(listener)
      }
    },
  }
  const document = {
    addEventListener: (type: string, listener: Listener) =>
      addListener(documentListeners, type, listener),
    documentElement: root,
    querySelectorAll: () => controls,
    removeEventListener: (type: string, listener: Listener) =>
      removeListener(documentListeners, type, listener),
  }
  const window = {
    addEventListener: (type: string, listener: Listener) =>
      addListener(windowListeners, type, listener),
    dispatchEvent: (event: FakeEvent) => {
      windowListeners
        .get(event.type)
        ?.forEach((listener) => listener({ type: event.type }))
      return true
    },
    localStorage: storage,
    matchMedia: () => mediaQueryList,
    removeEventListener: (type: string, listener: Listener) =>
      removeListener(windowListeners, type, listener),
  }

  Object.assign(globalThis, {
    document,
    Element: FakeElement,
    Event: FakeEvent,
    localStorage: storage,
    matchMedia: window.matchMedia,
    window,
  })

  return {
    classes,
    click: (target: FakeElement) => {
      documentListeners
        .get('click')
        ?.forEach((listener) => listener({ target, type: 'click' }))
    },
    controls,
    root,
    storage,
  }
}

afterEach(() => {
  Object.assign(globalThis, originalGlobals)
})

describe('compiled color-scheme scripts', () => {
  test('boot script parses and migrates legacy storage', () => {
    const harness = createBrowserHarness()

    harness.storage.setItem(legacyThemeStorageKey, 'system')

    const script = createColorSchemeBootScript()
    new Function(script)()

    expect(harness.storage.getItem(colorSchemeStorageKey)).toBe('system')
    expect(harness.storage.getItem(legacyThemeStorageKey)).toBeNull()
    expect(harness.classes.has(darkColorSchemeClassName)).toBe(true)
    expect(harness.root.dataset[colorSchemeDataAttribute]).toBe('system')
  })

  test('runtime script parses, syncs controls, and handles clicks', () => {
    const harness = createBrowserHarness()
    const lightControl = new FakeElement({
      [colorSchemeValueAttribute]: 'light',
    })
    const darkControl = new FakeElement({
      [colorSchemeValueAttribute]: 'dark',
    })

    harness.controls.push(lightControl, darkControl)

    const script = createColorSchemeRuntimeScript()
    new Function(script)()

    harness.click(darkControl)

    expect(harness.storage.getItem(colorSchemeStorageKey)).toBe('dark')
    expect(harness.classes.has(darkColorSchemeClassName)).toBe(true)
    expect(harness.root.dataset[colorSchemeDataAttribute]).toBe('dark')
    expect(darkControl.getAttribute('aria-pressed')).toBe('true')
    expect(lightControl.getAttribute('aria-pressed')).toBe('false')
  })
})
