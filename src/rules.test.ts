import { describe, it, expect } from 'vitest'
import {
  AGENDA_DETAIL_MAX, AGENDA_TEXT_MAX, agendaTile, applyAgendaPatch, canSeeAgendaItem, parseAgendaPatch, sortAgenda,
  validateAgendaDetail, validateAgendaText,
  type AgendaItem,
} from './rules.js'
import { RuleError } from './errors.js'

const NOW = '2026-09-30T12:00:00.000Z'
const item = (o: Partial<AgendaItem> = {}): AgendaItem => ({
  id: 'a1', owner: 'ana', text: 'the trip in November', done: false, doneAt: null,
  createdAt: '2026-09-30T09:00:00.000Z', ...o,
})

describe('agenda: what to bring up', () => {
  it('is seen by its owner and never by the other member', () => {
    expect(canSeeAgendaItem(item(), 'ana')).toBe(true)
    expect(canSeeAgendaItem(item(), 'ben')).toBe(false)
    expect(canSeeAgendaItem(item({ owner: 'ben' }), 'ana')).toBe(false)
  })

  it('answers the other member exactly as if the item did not exist', () => {
    let err: unknown
    try { applyAgendaPatch(item(), 'ben', { kind: 'done', value: true }, NOW) } catch (e) { err = e }
    expect(err).toBeInstanceOf(RuleError)
    expect((err as RuleError).status).toBe(404)
    expect((err as RuleError).message).toBe('not found')
  })

  it('checks off and back on, stamping when it was talked about', () => {
    const done = applyAgendaPatch(item(), 'ana', { kind: 'done', value: true }, NOW)
    expect(done).toMatchObject({ done: true, doneAt: NOW })
    expect(applyAgendaPatch(done, 'ana', { kind: 'done', value: false }, NOW)).toMatchObject({ done: false, doneAt: null })
  })

  it('rewrites text, trimmed, and refuses empty or too long', () => {
    expect(applyAgendaPatch(item(), 'ana', { kind: 'text', text: '  dinner plans  ' }, NOW).text).toBe('dinner plans')
    expect(validateAgendaText('  x ')).toBe('x')
    expect(() => validateAgendaText('   ')).toThrow(RuleError)
    expect(() => validateAgendaText(42)).toThrow(RuleError)
    expect(() => validateAgendaText('x'.repeat(AGENDA_TEXT_MAX + 1))).toThrow(RuleError)
  })

  it('parses only the two patch shapes', () => {
    expect(parseAgendaPatch({ kind: 'done', value: true })).toEqual({ kind: 'done', value: true })
    expect(parseAgendaPatch({ kind: 'text', text: 'a' })).toEqual({ kind: 'text', text: 'a' })
    expect(() => parseAgendaPatch({ kind: 'done', value: 'yes' })).toThrow(RuleError)
    expect(() => parseAgendaPatch({ kind: 'owner', value: 'ben' })).toThrow(RuleError)
    expect(() => parseAgendaPatch(null)).toThrow(RuleError)
  })

  it('reads in the order things came up, with what was talked about last, newest first', () => {
    const a = item({ id: 'a', createdAt: '2026-09-30T08:00:00.000Z' })
    const b = item({ id: 'b', createdAt: '2026-09-30T10:00:00.000Z' })
    const c = item({ id: 'c', done: true, doneAt: '2026-09-30T11:00:00.000Z' })
    const d = item({ id: 'd', done: true, doneAt: '2026-09-30T11:30:00.000Z' })
    expect(sortAgenda([d, b, c, a]).map((x) => x.id)).toEqual(['a', 'b', 'd', 'c'])
  })

  it('the tile counts what is still open and names the oldest', () => {
    expect(agendaTile([])).toEqual({ open: 0, next: null })
    const tile = agendaTile([
      item({ id: 'x', text: 'later', createdAt: '2026-09-30T10:00:00.000Z' }),
      item({ id: 'y', text: 'first', createdAt: '2026-09-30T08:00:00.000Z' }),
      item({ id: 'z', text: 'old', done: true, doneAt: NOW, createdAt: '2026-09-29T08:00:00.000Z' }),
    ])
    expect(tile).toEqual({ open: 2, next: 'first' })
  })

  it('keeps a detail trimmed, treats empty as none, and refuses a non-string or too long', () => {
    expect(validateAgendaDetail('  the full message, with https://example.com/a  ')).toBe('the full message, with https://example.com/a')
    expect(validateAgendaDetail('line one\n\nline two')).toBe('line one\n\nline two')
    expect(validateAgendaDetail(undefined)).toBeNull()
    expect(validateAgendaDetail(null)).toBeNull()
    expect(validateAgendaDetail('   ')).toBeNull()
    expect(validateAgendaDetail('x'.repeat(AGENDA_DETAIL_MAX))).toHaveLength(AGENDA_DETAIL_MAX)
    expect(() => validateAgendaDetail(42)).toThrow(RuleError)
    expect(() => validateAgendaDetail('x'.repeat(AGENDA_DETAIL_MAX + 1))).toThrow(RuleError)
    expect(AGENDA_DETAIL_MAX).toBe(4000)
  })

  it('parses a detail patch, a string to set and empty or null to clear', () => {
    expect(parseAgendaPatch({ kind: 'detail', detail: 'more' })).toEqual({ kind: 'detail', detail: 'more' })
    expect(parseAgendaPatch({ kind: 'detail', detail: null })).toEqual({ kind: 'detail', detail: null })
    expect(() => parseAgendaPatch({ kind: 'detail' })).toThrow(RuleError)
    expect(() => parseAgendaPatch({ kind: 'detail', detail: 7 })).toThrow(RuleError)
  })

  it('sets and clears the detail, only for its owner, and leaves the words alone', () => {
    const withDetail = applyAgendaPatch(item(), 'ana', { kind: 'detail', detail: '  the whole note  ' }, NOW)
    expect(withDetail).toMatchObject({ text: 'the trip in November', detail: 'the whole note' })
    const cleared = applyAgendaPatch(withDetail, 'ana', { kind: 'detail', detail: '' }, NOW)
    expect('detail' in cleared).toBe(false)
    expect('detail' in applyAgendaPatch(withDetail, 'ana', { kind: 'detail', detail: null }, NOW)).toBe(false)
    expect(applyAgendaPatch(withDetail, 'ana', { kind: 'text', text: 'new words' }, NOW).detail).toBe('the whole note')
    expect(() => applyAgendaPatch(item(), 'ben', { kind: 'detail', detail: 'x' }, NOW)).toThrow(RuleError)
  })
})
