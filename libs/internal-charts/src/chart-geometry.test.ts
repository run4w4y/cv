import { describe, expect, test } from 'bun:test'

import {
  buildAreaPath,
  buildDonutArc,
  buildLinePath,
  createChartTicks,
  getNiceDomain,
  getNumericExtent,
  toChartTimestamp,
} from './chart-geometry'

describe('chart geometry', () => {
  test('creates a zero-inclusive numeric extent', () => {
    expect(getNumericExtent([8, 12, 4])).toEqual({ minimum: 0, maximum: 12 })
    expect(getNumericExtent([-3, 2])).toEqual({ minimum: -3, maximum: 2 })
  })

  test('expands a flat extent', () => {
    expect(getNumericExtent([0, 0])).toEqual({ minimum: -1, maximum: 1 })
  })

  test('builds line and area paths', () => {
    const points = [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ]

    expect(buildLinePath(points)).toBe('M 1.00 2.00 L 3.00 4.00')
    expect(buildAreaPath(points, 8)).toBe(
      'M 1.00 2.00 L 3.00 4.00 L 3.00 8.00 L 1.00 8.00 Z'
    )
  })

  test('creates a donut arc without invalid full-circle geometry', () => {
    const path = buildDonutArc({
      center: 120,
      innerRadius: 62,
      outerRadius: 96,
      startAngle: -Math.PI / 2,
      endAngle: (3 * Math.PI) / 2,
    })

    expect(path).toStartWith('M 120.000 24.000')
    expect(path).not.toContain('NaN')
  })

  test('creates evenly spaced ticks', () => {
    expect(createChartTicks({ minimum: 0, maximum: 8 }, 3)).toEqual([0, 4, 8])
    expect(createChartTicks({ minimum: 0, maximum: 15 })).toEqual([
      0, 4, 8, 12, 16,
    ])
    expect(getNiceDomain({ minimum: 0, maximum: 15 })).toEqual({
      minimum: 0,
      maximum: 16,
    })
  })

  test('normalizes date-like x values with an index fallback', () => {
    expect(toChartTimestamp('2026-07-19', 3)).toBe(
      new Date('2026-07-19').getTime()
    )
    expect(toChartTimestamp('not-a-date', 3)).toBe(3)
  })
})
