import { describe, expect, test } from 'bun:test'
import { cloneValue, isContentPlainObject, mergeValue } from './merge'

const VariableLookup = ({
  fallback,
}: {
  fallback: string
  variable: string
}) => <>{fallback}</>

describe('content value helpers', () => {
  test('deep clones plain content but keeps JSX elements atomic', () => {
    const variableLookup = (
      <VariableLookup fallback="Public email" variable="person.email" />
    )
    const source = {
      contact: {
        value: variableLookup,
      },
    }

    const cloned = cloneValue(source)

    expect(cloned).not.toBe(source)
    expect(cloned.contact).not.toBe(source.contact)
    expect(cloned.contact.value).toBe(variableLookup)
    expect(isContentPlainObject(source)).toBe(true)
    expect(isContentPlainObject(variableLookup)).toBe(false)
  })

  test('deep merges objects while replacing arrays', () => {
    const merged = mergeValue(
      {
        labels: {
          keep: 'Keep',
          replace: 'Old',
        },
        stack: ['old'],
      },
      {
        labels: {
          replace: 'New',
        },
        stack: ['new'],
      }
    )

    expect(merged).toEqual({
      labels: {
        keep: 'Keep',
        replace: 'New',
      },
      stack: ['new'],
    })
  })
})
