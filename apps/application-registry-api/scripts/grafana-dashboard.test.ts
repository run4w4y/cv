import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const dashboardTemplatePath = resolve(
  import.meta.dir,
  '../../../terraform/grafana/dashboards/cv-applications.json.tftpl'
)
const terraformInterpolation = (name: string) => ['$', `{${name}}`].join('')

const renderDashboard = async () =>
  (await readFile(dashboardTemplatePath, 'utf8'))
    .replaceAll(
      terraformInterpolation('application_registry_datasource_uid'),
      'registry-datasource'
    )
    .replaceAll(
      terraformInterpolation('registry_api_url'),
      'https://registry.example.test'
    )
    .replaceAll('$${', '${')

describe('Grafana applications dashboard', () => {
  test('renders valid JSON against the v2 machine transport', async () => {
    const rendered = await renderDashboard()

    expect(() => JSON.parse(rendered)).not.toThrow()
    expect(rendered).toContain(
      'https://registry.example.test/machine/api/registry/applications'
    )
    expect(rendered).toContain(
      'https://registry.example.test/machine/api/registry/activities'
    )
    expect(rendered).toContain(
      '/api/datasources/proxy/uid/registry-datasource/machine/api/registry/'
    )
    expect(rendered).not.toContain('/v1/')
  })

  test('uses current list response fields and mutation requirements', async () => {
    const rendered = await renderDashboard()

    for (const field of [
      'postingUrl',
      'latestActivity.kind',
      'latestActivity.occurredAt',
      'counts.notes',
    ]) {
      expect(rendered).toContain(`"selector": "${field}"`)
    }

    for (const removedField of [
      'canonicalUrl',
      'counts.captures',
      'fitScore',
      'latestEvent',
      'recommendedAction',
    ]) {
      expect(rendered).not.toContain(removedField)
    }

    expect(rendered).toContain('"idempotency-key"')
    expect(rendered).toContain('"key": "noteRequestId"')
    expect(rendered).toContain('$noteKind-$noteRequestId')
    expect(rendered).toContain('\\"expectedVersion\\"')
    expect(rendered).not.toContain('contact_logged')
    expect(rendered).not.toContain('research_updated')
  })
})
