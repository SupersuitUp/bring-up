// @vitest-environment node
// To Bring Up, package against Us at 7e65c60, over records shaped like us_agenda. Plan 4 moves
// Us onto the package behind this proof: if any line here fails, someone would see a change.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as mod from '../../src/rules.js'
import * as old from './oracle/agenda.js'
import { createBringUpStore } from '../../src/server/store.js'
import { fakeFirestore } from '../support/fake-firestore.js'

type Stored = Record<string, Record<string, unknown>>
const stored = JSON.parse(readFileSync(join(__dirname, 'fixtures/us_agenda.json'), 'utf8')) as Stored
const items = Object.entries(stored).map(([id, d]) => ({ id, ...d })) as unknown as old.AgendaItem[]
const MEMBERS = ['ana', 'ben'] as const
const NOW = '2026-09-30T12:00:00.000Z'

// What a call produced, or how it refused: the same refusal is the same words and status.
function outcome(f: () => unknown) {
  try { return { ok: f() } } catch (e) { const err = e as { message: string; status?: number }; return { refused: err.message, status: err.status } }
}

const PATCHES: mod.AgendaPatch[] = [
  { kind: 'done', value: true }, { kind: 'done', value: false },
  { kind: 'text', text: '  new words  ' }, { kind: 'text', text: '   ' }, { kind: 'text', text: 'x'.repeat(501) },
]
const BODIES: unknown[] = [
  { kind: 'done', value: true }, { kind: 'done', value: 'yes' }, { kind: 'text', text: 'a' }, { kind: 'text' },
  { kind: 'owner', value: 'ben' }, null, undefined, 'done',
]
const TEXTS: unknown[] = ['x', '  x  ', '', '   ', 42, null, 'x'.repeat(500), 'x'.repeat(501)]

describe('To Bring Up parity with Us at 7e65c60', () => {
  for (const m of MEMBERS) {
    it(`${m} sees exactly what Us shows, in the same order, with the same tile`, () => {
      const visibleMod = mod.sortAgenda(items.filter((a) => mod.canSeeAgendaItem(a, m)))
      const visibleOld = old.sortAgenda(items.filter((a) => old.canSeeAgendaItem(a, m)))
      expect(visibleMod).toEqual(visibleOld)
      expect(mod.agendaTile(visibleMod)).toEqual(old.agendaTile(visibleOld))
      for (const a of items) expect(mod.canSeeAgendaItem(a, m)).toBe(old.canSeeAgendaItem(a, m))
    })

    it(`every change ${m} could ask for lands or refuses the same way`, () => {
      for (const a of items) for (const p of PATCHES) {
        expect(outcome(() => mod.applyAgendaPatch(a, m, p, NOW))).toEqual(outcome(() => old.applyAgendaPatch(a, m, p, NOW)))
      }
    })
  }

  it('the same request bodies parse the same way, and the same words are kept or refused', () => {
    for (const b of BODIES) expect(outcome(() => mod.parseAgendaPatch(b))).toEqual(outcome(() => old.parseAgendaPatch(b)))
    for (const t of TEXTS) expect(outcome(() => mod.validateAgendaText(t))).toEqual(outcome(() => old.validateAgendaText(t)))
    expect(mod.AGENDA_TEXT_MAX).toBe(old.AGENDA_TEXT_MAX)
  })
})

describe('round trip through the store, on records shaped like us_agenda', () => {
  const setup = () => {
    const f = fakeFirestore()
    f.seed('us_agenda', stored)
    return { f, store: createBringUpStore<'ana' | 'ben'>({ db: () => f.db, collection: 'us_agenda' }) }
  }

  it('reads every record exactly as stored, adding only its id', async () => {
    const { store } = setup()
    for (const m of MEMBERS) {
      const listed = await store.listAgenda(m)
      expect(listed.map((a) => a.id).sort()).toEqual(Object.keys(stored).filter((id) => stored[id].owner === m).sort())
      for (const { id, ...rest } of listed) expect(rest).toStrictEqual(stored[id])
    }
  })

  it('checking one off writes done and doneAt and nothing else', async () => {
    const { f, store } = setup()
    await store.patchAgendaItem('ana', 'a1', { kind: 'done', value: true })
    const after = f.raw('us_agenda', 'a1')!
    expect(after.done).toBe(true)
    expect(typeof after.doneAt).toBe('string')
    expect({ ...after, done: false, doneAt: null }).toStrictEqual(stored.a1)
  })

  it('editing the words writes text and nothing else', async () => {
    const { f, store } = setup()
    await store.patchAgendaItem('ben', 'b3', { kind: 'text', text: ' tidy ' })
    expect(f.raw('us_agenda', 'b3')).toStrictEqual({ ...stored.b3, text: 'tidy' })
  })

  it("leaves the other person's records exactly as they were through every refusal", async () => {
    const { f, store } = setup()
    await expect(store.patchAgendaItem('ben', 'a1', { kind: 'done', value: true })).rejects.toMatchObject({ status: 404 })
    await expect(store.deleteAgendaItem('ben', 'a1')).rejects.toMatchObject({ status: 404 })
    expect(f.all('us_agenda')).toStrictEqual(stored)
  })

  it('clearing what was talked about removes exactly those records', async () => {
    const { f, store } = setup()
    expect(await store.clearDoneAgenda('ana')).toBe(2)
    expect(Object.keys(f.all('us_agenda')).sort()).toEqual(['a1', 'a3', 'b1', 'b2', 'b3'])
  })

  it('a new item has exactly the fields stored items have', async () => {
    const { f, store } = setup()
    const a = await store.addAgendaItem('ben', ' something ')
    expect(Object.keys(f.raw('us_agenda', a.id)!).sort()).toEqual(Object.keys(stored.b1).sort())
  })
})

describe('a record that carries its own id field', () => {
  const withId = JSON.parse(readFileSync(join(__dirname, 'fixtures/us_agenda_stored_id.json'), 'utf8')) as Stored

  // The source app's two store lines, replayed over the same fake: read is `{ id: doc.id, ...data }`,
  // write-back is `const { id: _id, ...data } = updated; tx.set(ref, data)`.
  async function sourceBehaviour() {
    const f = fakeFirestore()
    f.seed('us_agenda', withId)
    const ref = f.db.collection('us_agenda').doc('c1')
    const read = { id: 'c1', ...((await ref.get()).data() as object) } as unknown as old.AgendaItem
    const updated = old.applyAgendaPatch(read, 'ana', { kind: 'done', value: true }, NOW)
    const { id: _id, ...data } = updated
    await ref.set(data)
    return { read, written: f.raw('us_agenda', 'c1') }
  }

  it('the package and the source read it and write it back the same way', async () => {
    const f = fakeFirestore()
    f.seed('us_agenda', withId)
    const store = createBringUpStore<'ana' | 'ben'>({ db: () => f.db, collection: 'us_agenda' })
    const [read] = await store.listAgenda('ana')
    const src = await sourceBehaviour()
    expect(read).toStrictEqual({ ...src.read })
    await store.patchAgendaItem('ana', 'c1', { kind: 'done', value: true })
    // doneAt is the wall clock in the package and NOW in the replay; everything else must match.
    expect({ ...f.raw('us_agenda', 'c1'), doneAt: NOW }).toStrictEqual(src.written)
    expect(f.raw('us_agenda', 'c1')).not.toHaveProperty('id')
  })
})

