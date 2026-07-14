import { describe, expect, test } from 'bun:test'
import {
  buildCodexOptions,
  buildCodexProcessEnv,
  buildCodexThreadOptions,
} from './advisor'
import type { CodexStructuredAiOptions } from './structured'

const advisorOptions: CodexStructuredAiOptions = {
  binaryPath: '/opt/codex',
  model: 'gpt-5.4',
  reasoningEffort: 'high',
}

describe('Codex advisor process environment', () => {
  test('passes only Codex auth and operational variables to the child', () => {
    const result = buildCodexProcessEnv('/tmp/isolated-codex-home', {
      CODEX_ACCESS_TOKEN: 'codex-auth',
      CLOUDFLARE_API_TOKEN: 'cloudflare-secret',
      CODEX_HOME: '/home/user/.codex',
      CONTENT_REPO_TOKEN: 'repository-secret',
      GRAFANA_AUTH: 'grafana-secret',
      HOME: '/home/user',
      INFISICAL_TOKEN: 'infisical-secret',
      LANG: 'en_US.UTF-8',
      PATH: '/usr/bin:/bin',
      PRIVATE_CONTENT_ROOT_KEY: 'private-content-secret',
      SSL_CERT_FILE: '/etc/ssl/certs/ca-certificates.crt',
    })

    expect(result).toEqual({
      CODEX_ACCESS_TOKEN: 'codex-auth',
      CODEX_HOME: '/tmp/isolated-codex-home',
      HOME: '/tmp/isolated-codex-home',
      LANG: 'en_US.UTF-8',
      PATH: '/usr/bin:/bin',
      SSL_CERT_FILE: '/etc/ssl/certs/ca-certificates.crt',
    })
    expect(result).not.toHaveProperty('CLOUDFLARE_API_TOKEN')
    expect(result).not.toHaveProperty('CONTENT_REPO_TOKEN')
    expect(result).not.toHaveProperty('GRAFANA_AUTH')
    expect(result).not.toHaveProperty('INFISICAL_TOKEN')
    expect(result).not.toHaveProperty('PRIVATE_CONTENT_ROOT_KEY')
  })

  test('omits empty optional variables', () => {
    expect(
      buildCodexProcessEnv('/tmp/isolated-codex-home', {
        CODEX_HOME: '',
        HOME: '/home/user',
        PATH: undefined,
      })
    ).toEqual({
      CODEX_HOME: '/tmp/isolated-codex-home',
      HOME: '/tmp/isolated-codex-home',
    })
  })
})

describe('Codex advisor restrictions', () => {
  test('disables command execution and persistence at process startup', () => {
    expect(
      buildCodexOptions(advisorOptions, '/tmp/isolated-codex-home', {
        HOME: '/home/user',
        PATH: '/usr/bin:/bin',
      })
    ).toEqual({
      codexPathOverride: '/opt/codex',
      config: {
        features: {
          shell_snapshot: false,
          shell_tool: false,
          skill_mcp_dependency_install: false,
          unified_exec: false,
        },
        history: {
          persistence: 'none',
        },
        shell_environment_policy: {
          experimental_use_profile: false,
          ignore_default_excludes: false,
          inherit: 'none',
        },
      },
      env: {
        CODEX_HOME: '/tmp/isolated-codex-home',
        HOME: '/tmp/isolated-codex-home',
        PATH: '/usr/bin:/bin',
      },
    })
  })

  test('uses the disposable workspace with no approvals or network access', () => {
    expect(
      buildCodexThreadOptions(advisorOptions, '/tmp/isolated-workspace')
    ).toEqual({
      approvalPolicy: 'never',
      model: 'gpt-5.4',
      modelReasoningEffort: 'high',
      networkAccessEnabled: false,
      sandboxMode: 'read-only',
      skipGitRepoCheck: true,
      webSearchMode: 'disabled',
      workingDirectory: '/tmp/isolated-workspace',
    })
  })
})
