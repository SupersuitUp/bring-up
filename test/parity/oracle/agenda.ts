import type { Member } from './shim.js'
import { RuleError } from './shim.js'

export interface AgendaItem {
  id: string; owner: Member; text: string
  done: boolean; doneAt: string | null
  createdAt: string
}
export type AgendaPatch = { kind: 'done'; value: boolean } | { kind: 'text'; text: string }
export interface AgendaSummary { open: number; next: string | null }

export const AGENDA_TEXT_MAX = 500

export const canSeeAgendaItem = (a: Pick<AgendaItem, 'owner'>, m: Member) => a.owner === m

export function validateAgendaText(text: unknown): string {
  if (typeof text !== 'string') throw new RuleError('text must be a string', 400)
  const t = text.trim()
  if (!t) throw new RuleError('write something to bring up', 400)
  if (t.length > AGENDA_TEXT_MAX) throw new RuleError(`keep it under ${AGENDA_TEXT_MAX} characters`, 400)
  return t
}

export function parseAgendaPatch(body: unknown): AgendaPatch {
  const b = (body ?? {}) as { kind?: unknown; value?: unknown; text?: unknown }
  if (b.kind === 'done') {
    if (typeof b.value !== 'boolean') throw new RuleError('value must be a boolean', 400)
    return { kind: 'done', value: b.value }
  }
  if (b.kind === 'text') {
    if (typeof b.text !== 'string') throw new RuleError('text must be a string', 400)
    return { kind: 'text', text: b.text }
  }
  throw new RuleError('unknown patch kind', 400)
}

export function applyAgendaPatch(a: AgendaItem, m: Member, patch: AgendaPatch, now: string): AgendaItem {
  if (!canSeeAgendaItem(a, m)) throw new RuleError('not found', 404)
  if (patch.kind === 'done') return { ...a, done: patch.value, doneAt: patch.value ? now : null }
  return { ...a, text: validateAgendaText(patch.text) }
}

// Open items in the order they came up, so the oldest thing waiting is first; then what has been
// talked about, most recent first.
export function sortAgenda(items: AgendaItem[]): AgendaItem[] {
  const open = items.filter((a) => !a.done).sort((x, y) => x.createdAt.localeCompare(y.createdAt))
  const done = items.filter((a) => a.done).sort((x, y) => (y.doneAt ?? '').localeCompare(x.doneAt ?? ''))
  return [...open, ...done]
}

export function agendaTile(items: AgendaItem[]): AgendaSummary {
  const open = sortAgenda(items).filter((a) => !a.done)
  return { open: open.length, next: open[0]?.text ?? null }
}
