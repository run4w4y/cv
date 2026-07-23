import { afterEach, describe, expect, mock, test } from 'bun:test'
import type {
  DesktopHostBridge,
  DesktopRegistryConfiguration,
} from '@cv/application-registry-desktop-contract'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'

import { HostBootstrap } from './bootstrap'
import { RegistryConnectionControl } from './registry-connection-dialog'
import {
  invalidateWebRegistryConnection,
  WEB_REGISTRY_CONNECTION_SCHEMA_VERSION,
  WEB_REGISTRY_CONNECTION_STORAGE_KEY,
} from './web-registry-connection'

const originalFetch = globalThis.fetch

const storedConfiguration: DesktopRegistryConfiguration = {
  configured: true,
  editable: true,
  origin: 'https://registry.example.test',
  source: 'stored',
}

const unavailable = {
  error: {
    code: 'network_failed' as const,
    message: 'Unavailable in this test.',
  },
  ok: false as const,
}

const installBridge = (registry: DesktopHostBridge['registry']) => {
  const bridge: DesktopHostBridge = {
    codex: {
      cancel: async () => ({ ok: true, value: undefined }),
      generate: async () => unavailable,
      status: async () => unavailable,
    },
    network: { fetch: async () => unavailable },
    registry,
  }
  Object.defineProperty(window, 'cvDesktop', {
    configurable: true,
    value: bridge,
  })
}

afterEach(() => {
  cleanup()
  globalThis.fetch = originalFetch
  window.localStorage.clear()
  invalidateWebRegistryConnection()
  Object.defineProperty(window, 'cvDesktop', {
    configurable: true,
    value: undefined,
  })
})

describe('RegistryConnectionControl', () => {
  test('updates stored settings from the sidebar without returning the token', async () => {
    const status = mock(async () => ({
      ok: true as const,
      value: storedConfiguration,
    }))
    const configure = mock(async () => ({
      ok: true as const,
      value: {
        ...storedConfiguration,
        origin: 'https://new-registry.example.test',
      },
    }))
    installBridge({ configure, status })
    const reload = mock(() => undefined)
    const view = render(<RegistryConnectionControl reload={reload} />)

    await view.findByText('https://registry.example.test')
    fireEvent.click(
      view.getByRole('button', {
        name: 'Open Registry connection settings',
      })
    )
    const origin = await view.findByRole('textbox', {
      name: 'Registry API base URL',
    })
    fireEvent.change(origin, {
      target: { value: 'https://new-registry.example.test' },
    })
    fireEvent.click(view.getByRole('button', { name: 'Test and save' }))

    await waitFor(() =>
      expect(configure).toHaveBeenCalledWith({
        origin: 'https://new-registry.example.test',
      })
    )
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
  })

  test('explains environment-managed connections without exposing an editor', async () => {
    installBridge({
      configure: async () => unavailable,
      status: async () => ({
        ok: true,
        value: {
          configured: true,
          editable: false,
          origin: 'https://environment-registry.example.test',
          source: 'environment',
        },
      }),
    })
    const view = render(<RegistryConnectionControl />)

    await view.findByText('https://environment-registry.example.test')
    fireEvent.click(
      view.getByRole('button', {
        name: 'Open Registry connection settings',
      })
    )

    expect(await view.findByText('Managed by the environment')).toBeTruthy()
    expect(view.queryByLabelText('New Registry bearer token')).toBeNull()
  })

  test('shows and updates the effective browser base URL', async () => {
    window.localStorage.clear()
    invalidateWebRegistryConnection()
    const fetcher = mock(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const request =
          input instanceof Request ? input : new Request(input, init)
        expect(request.url).toBe(
          'https://browser-registry.example.test/api/registry/health'
        )
        expect(request.headers.get('authorization')).toBe(
          'Bearer browser-token'
        )
        return Response.json({ ok: true })
      }
    )
    globalThis.fetch = fetcher as unknown as typeof fetch
    const reload = mock(() => undefined)
    const view = render(<RegistryConnectionControl reload={reload} />)

    const defaultUrl = await view.findByText('https://cv-api.4w4y.run')
    expect(defaultUrl.className).toContain('truncate')
    expect(defaultUrl.getAttribute('title')).toBe('https://cv-api.4w4y.run')

    fireEvent.click(
      view.getByRole('button', {
        name: 'Open Registry connection settings',
      })
    )
    fireEvent.change(
      await view.findByRole('textbox', { name: 'Registry API base URL' }),
      { target: { value: 'https://browser-registry.example.test' } }
    )
    fireEvent.change(view.getByLabelText('Registry bearer token'), {
      target: { value: 'browser-token' },
    })
    fireEvent.click(view.getByRole('button', { name: 'Test and save' }))

    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
    expect(
      JSON.parse(
        window.localStorage.getItem(WEB_REGISTRY_CONNECTION_STORAGE_KEY) ?? ''
      )
    ).toEqual({
      origin: 'https://browser-registry.example.test',
      schemaVersion: WEB_REGISTRY_CONNECTION_SCHEMA_VERSION,
      token: 'browser-token',
    })
  })

  test('restores a browser override to the hosted default', async () => {
    const overrideUrl = 'https://a-very-long-registry-hostname.example.test'
    window.localStorage.setItem(
      WEB_REGISTRY_CONNECTION_STORAGE_KEY,
      JSON.stringify({
        origin: overrideUrl,
        schemaVersion: WEB_REGISTRY_CONNECTION_SCHEMA_VERSION,
        token: 'browser-token',
      })
    )
    invalidateWebRegistryConnection()
    const reload = mock(() => undefined)
    const view = render(<RegistryConnectionControl reload={reload} />)

    const displayedUrl = await view.findByText(overrideUrl)
    expect(displayedUrl.className).toContain('truncate')
    expect(displayedUrl.getAttribute('title')).toBe(overrideUrl)
    fireEvent.click(
      view.getByRole('button', {
        name: 'Open Registry connection settings',
      })
    )
    fireEvent.click(
      await view.findByRole('button', {
        name: 'Use default configuration',
      })
    )

    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
    expect(
      window.localStorage.getItem(WEB_REGISTRY_CONNECTION_STORAGE_KEY)
    ).toBeNull()
  })
})

describe('HostBootstrap', () => {
  test('uses the verified connection form for first-run setup', async () => {
    const configured: DesktopRegistryConfiguration = {
      configured: true,
      editable: true,
      origin: 'https://registry.example.test',
      source: 'stored',
    }
    const configure = mock(async () => ({
      ok: true as const,
      value: configured,
    }))
    installBridge({
      configure,
      status: async () => ({
        ok: true,
        value: {
          configured: false,
          editable: true,
          origin: null,
          source: 'unconfigured',
        },
      }),
    })
    const view = render(
      <HostBootstrap>
        <p>Registry application ready</p>
      </HostBootstrap>
    )

    fireEvent.change(
      await view.findByRole('textbox', { name: 'Registry API base URL' }),
      { target: { value: 'https://registry.example.test' } }
    )
    fireEvent.change(view.getByLabelText('Registry bearer token'), {
      target: { value: 'machine-token' },
    })
    fireEvent.click(
      view.getByRole('button', {
        name: 'Test, save, and open Registry',
      })
    )

    await waitFor(() =>
      expect(configure).toHaveBeenCalledWith({
        origin: 'https://registry.example.test',
        token: 'machine-token',
      })
    )
    expect(await view.findByText('Registry application ready')).toBeTruthy()
  })
})
