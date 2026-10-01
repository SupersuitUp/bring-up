import { describe, it, expect } from 'vitest'
import {
  AGENDA_TEXT_MAX, agendaTile, applyAgendaPatch, canSeeAgendaItem, parseAgendaPatch, sortAgenda, validateAgendaText,
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
})
