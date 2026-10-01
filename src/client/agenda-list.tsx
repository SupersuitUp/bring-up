'use client'

import { useState } from 'react'
import { sortAgenda, AGENDA_TEXT_MAX, type AgendaItem } from '../rules.js'
import { HAIRLINE, INK, MUTED, ON_INK, SERIF } from './theme.js'
import { SectionLabel } from './section-label.js'

// One member's own list of things to bring up when they next talk. Every change saves on tap and
// snaps back if the save fails, like the notification switches.
// apiBase is where the app mounted this package's list handlers.
export function AgendaList({ initial, otherName, apiBase }: { initial: AgendaItem[]; otherName: string; apiBase: string }) {
  const [items, setItems] = useState(() => sortAgenda(initial))
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [failed, setFailed] = useState(false)

  const open = items.filter((a) => !a.done)
  const done = items.filter((a) => a.done)

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text || adding) return
    setAdding(true); setFailed(false)
    try {
      const res = await fetch(apiBase, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error(String(res.status))
      const created = (await res.json()) as AgendaItem
      setItems((xs) => sortAgenda([...xs, created]))
      setDraft('')
    } catch {
      setFailed(true)
    } finally {
      setAdding(false)
    }
  }

  // Applies a change on screen at once, then keeps what the server says or puts the old list back.
  const save = async (next: AgendaItem[], url: string, init: RequestInit, apply?: (res: Response) => Promise<AgendaItem[]>) => {
    const before = items
    setItems(sortAgenda(next)); setFailed(false)
    try {
      const res = await fetch(url, init)
      if (!res.ok) throw new Error(String(res.status))
      if (apply) setItems(sortAgenda(await apply(res)))
    } catch {
      setItems(before); setFailed(true)
    }
  }

  const toggle = (a: AgendaItem) => {
    const value = !a.done
    const flipped = { ...a, done: value, doneAt: value ? new Date().toISOString() : null }
    return save(items.map((x) => (x.id === a.id ? flipped : x)), `${apiBase}/${a.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'done', value }),
    }, async (res) => {
      const kept = (await res.json()) as AgendaItem
      return items.map((x) => (x.id === a.id ? kept : x))
    })
  }

  const remove = (a: AgendaItem) =>
    save(items.filter((x) => x.id !== a.id), `${apiBase}/${a.id}`, { method: 'DELETE' })

  const clearDone = () => save(open, apiBase, { method: 'DELETE' })

  const row = (a: AgendaItem) => (
    <li key={a.id} className="flex items-center gap-3 rounded-2xl px-3 py-2" style={{ backgroundColor: HAIRLINE }}>
      <button type="button" role="checkbox" aria-checked={a.done} aria-label={a.text} onClick={() => toggle(a)}
        className="flex h-11 w-11 shrink-0 items-center justify-center">
        <span className="flex h-6 w-6 items-center justify-center rounded-full text-sm"
          style={a.done ? { backgroundColor: INK, color: ON_INK } : { border: `1.5px solid ${MUTED}` }}>
          {a.done ? '✓' : ''}
        </span>
      </button>
      <span className="min-w-0 flex-1 break-words text-[17px] leading-snug"
        style={{ fontFamily: SERIF, color: a.done ? MUTED : INK, textDecoration: a.done ? 'line-through' : 'none' }}>
        {a.text}
      </span>
      <button type="button" aria-label={`Delete ${a.text}`} onClick={() => remove(a)}
        className="flex h-11 w-11 shrink-0 items-center justify-center text-xl" style={{ color: MUTED }}>
        ×
      </button>
    </li>
  )

  return (
    <div className="px-4">
      <p className="mb-4 px-1 text-sm leading-snug" style={{ color: MUTED }}>
        Only you can see this list. {otherName} never sees it. Save things here and bring them up when you talk.
      </p>
      <form onSubmit={add} className="mb-6 flex gap-2">
        <input
          type="text" value={draft} maxLength={AGENDA_TEXT_MAX} onChange={(e) => setDraft(e.target.value)}
          aria-label="Something to bring up" placeholder="Something to bring up"
          className="h-12 min-w-0 flex-1 rounded-2xl px-4 text-[17px] outline-none"
          style={{ backgroundColor: HAIRLINE, color: INK, fontFamily: SERIF }}
        />
        <button type="submit" disabled={adding || !draft.trim()}
          className="h-12 shrink-0 rounded-2xl px-5 text-[17px] font-medium transition-opacity disabled:opacity-50"
          style={{ backgroundColor: INK, color: ON_INK }}>
          Add
        </button>
      </form>
      {failed && <p className="-mt-3 mb-4 px-1 text-xs" style={{ color: MUTED }}>That did not save. Try again?</p>}

      {open.length === 0 && done.length === 0 && (
        <p className="py-12 text-center text-[17px]" style={{ color: MUTED, fontFamily: SERIF }}>Nothing waiting. Add the next thing that comes to mind.</p>
      )}
      {open.length > 0 && <ol className="flex flex-col gap-2">{open.map(row)}</ol>}

      {done.length > 0 && (
        <section aria-label="Talked about" className="mt-8">
          <div className="mb-2 flex items-center justify-between px-1">
            <SectionLabel>Talked about</SectionLabel>
            <button type="button" onClick={clearDone} className="inline-flex h-11 items-center px-2 text-sm" style={{ color: MUTED }}>Clear</button>
          </div>
          <ol className="flex flex-col gap-2">{done.map(row)}</ol>
        </section>
      )}
    </div>
  )
}
