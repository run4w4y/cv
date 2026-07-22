import { afterEach, describe, expect, mock, test } from 'bun:test'
import type {
  DesktopHostBridge,
  DesktopRegistryConfiguration,
} from '@cv/application-registry-desktop-contract'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'

import { HostBootstrap } from './bootstrap'
import { RegistryConnectionControl } from './registry-connection-dialog'

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

    await view.findByText('registry.example.test')
    fireEvent.click(
      view.getByRole('button', {
        name: 'Open Registry connection settings',
      })
    )
    const origin = await view.findByRole('textbox', {
      name: 'Registry API origin',
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

    await view.findByText('environment-registry.example.test')
    fireEvent.click(
      view.getByRole('button', {
        name: 'Open Registry connection settings',
      })
    )

    expect(await view.findByText('Managed by the environment')).toBeTruthy()
    expect(view.queryByLabelText('New machine API token')).toBeNull()
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
      await view.findByRole('textbox', { name: 'Registry API origin' }),
      { target: { value: 'https://registry.example.test' } }
    )
    fireEvent.change(view.getByLabelText('Machine API token'), {
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
