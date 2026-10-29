import { RuleError } from './errors.js'
import type { AgendaItem, AgendaPatch, AgendaSummary } from './types.js'

export type { AgendaItem, AgendaPatch, AgendaSummary } from './types.js'

// These rules are moved unchanged in behaviour from the app they were built in; a parity suite
// compares the two over that app's records.

export const AGENDA_TEXT_MAX = 500
export const AGENDA_DETAIL_MAX = 4000

export const canSeeAgendaItem = <M extends string>(a: Pick<AgendaItem<M>, 'owner'>, m: M) => a.owner === m

export function validateAgendaText(text: unknown): string {
  if (typeof text !== 'string') throw new RuleError('text must be a string', 400)
  const t = text.trim()
  if (!t) throw new RuleError('write something to bring up', 400)
  if (t.length > AGENDA_TEXT_MAX) throw new RuleError(`keep it under ${AGENDA_TEXT_MAX} characters`, 400)
  return t
}

// A detail is optional: missing, null or blank all mean none, so it answers null rather than refusing.
export function validateAgendaDetail(detail: unknown): string | null {
  if (detail === undefined || detail === null) return null
  if (typeof detail !== 'string') throw new RuleError('detail must be a string', 400)
  const d = detail.trim()
  if (!d) return null
  if (d.length > AGENDA_DETAIL_MAX) throw new RuleError(`keep the detail under ${AGENDA_DETAIL_MAX} characters`, 400)
  return d
}

// The item with its detail set, or with no `detail` field at all when there is none.
export function withAgendaDetail<T extends { detail?: string }>(a: T, detail: string | null): T {
  const { detail: _old, ...rest } = a
  return (detail === null ? rest : { ...rest, detail }) as T
}

export function parseAgendaPatch(body: unknown): AgendaPatch {
  const b = (body ?? {}) as { kind?: unknown; value?: unknown; text?: unknown; detail?: unknown }
  if (b.kind === 'done') {
    if (typeof b.value !== 'boolean') throw new RuleError('value must be a boolean', 400)
    return { kind: 'done', value: b.value }
  }
  if (b.kind === 'text') {
    if (typeof b.text !== 'string') throw new RuleError('text must be a string', 400)
    return { kind: 'text', text: b.text }
  }
  if (b.kind === 'detail') {
    if (typeof b.detail !== 'string' && b.detail !== null) throw new RuleError('detail must be a string, or null to clear it', 400)
    return { kind: 'detail', detail: b.detail }
  }
  throw new RuleError('unknown patch kind', 400)
}

export function applyAgendaPatch<M extends string>(a: AgendaItem<M>, m: M, patch: AgendaPatch, now: string): AgendaItem<M> {
  if (!canSeeAgendaItem(a, m)) throw new RuleError('not found', 404)
  if (patch.kind === 'done') return { ...a, done: patch.value, doneAt: patch.value ? now : null }
  if (patch.kind === 'detail') return withAgendaDetail(a, validateAgendaDetail(patch.detail))
  return { ...a, text: validateAgendaText(patch.text) }
}

// Open items in the order they came up, so the oldest thing waiting is first; then what has been
// talked about, most recent first.
export function sortAgenda<M extends string>(items: AgendaItem<M>[]): AgendaItem<M>[] {
  const open = items.filter((a) => !a.done).sort((x, y) => x.createdAt.localeCompare(y.createdAt))
  const done = items.filter((a) => a.done).sort((x, y) => (y.doneAt ?? '').localeCompare(x.doneAt ?? ''))
  return [...open, ...done]
}

export function agendaTile(items: AgendaItem[]): AgendaSummary {
  const open = sortAgenda(items).filter((a) => !a.done)
  return { open: open.length, next: open[0]?.text ?? null }
}
