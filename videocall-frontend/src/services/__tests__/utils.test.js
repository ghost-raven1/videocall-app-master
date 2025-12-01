/**
 * @jest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import { utils } from '../utils'

describe('utils.normalizeRouteParam', () => {
  it('returns string as-is trimmed', () => {
    expect(utils.normalizeRouteParam('room')).toBe('room')
    expect(utils.normalizeRouteParam('  room  ')).toBe('room')
  })

  it('handles array by taking the first element and trimming', () => {
    expect(utils.normalizeRouteParam(['first', 'second'])).toBe('first')
    expect(utils.normalizeRouteParam(['  x  '])).toBe('x')
  })

  it('returns empty string for null/undefined', () => {
    expect(utils.normalizeRouteParam(null)).toBe('')
    expect(utils.normalizeRouteParam(undefined)).toBe('')
  })

  it('handles empty string', () => {
    expect(utils.normalizeRouteParam('')).toBe('')
  })
})

