import { describe, expect, it } from 'vitest'
import { fakeFirestore } from '../../test/support/fake-firestore.js'
import { createBringUpStore } from './store.js'
import { RuleError } from '../errors.js'

const item = (owner: string, text: string, createdAt: string, done = false) =>
  ({ owner, text, done, doneAt: done ? '2026-09-30T10:00:00.000Z' : null, createdAt })

function setup() {
  const f = fakeFirestore()
  f.seed('lists', {
    a1: item('ana', 'later', '2026-09-30T10:00:00.000Z'),
    a2: item('ana', 'first', '2026-09-30T08:00:00.000Z'),
    a3: item('ana', 'talked', '2026-09-29T08:00:00.000Z', true),
    b1: item('ben', 'his', '2026-09-30T09:00:00.000Z'),
  })
  return { f, store: createBringUpStore<'ana' | 'ben'>({ db: () => f.db, collection: 'lists' }) }
}

describe('the To Bring Up store', () => {
  it("lists only this person's items, open first in the order they came up", async () => {
    const { store } = setup()
    expect((await store.listAgenda('ana')).map((a) => a.id)).toEqual(['a2', 'a1', 'a3'])
    expect((await store.listAgenda('ben')).map((a) => a.id)).toEqual(['b1'])
  })

  it('reads and writes the list the app names, and no other', async () => {
    const { f, store } = setup()
    const added = await store.addAgendaItem('ben', '  the weekend  ')
    expect(f.raw('lists', added.id)).toEqual({ owner: 'ben', text: 'the weekend', done: false, doneAt: null, createdAt: added.createdAt })
    expect(f.all('agenda')).toEqual({})
  })

  it('refuses blank words and writes nothing', async () => {
    const { f, store } = setup()
    await expect(store.addAgendaItem('ana', '   ')).rejects.toMatchObject({ status: 400, message: 'write something to bring up' })
    expect(Object.keys(f.all('lists'))).toHaveLength(4)
  })

  it("answers someone else's item exactly as a missing one, and leaves it untouched", async () => {
    const { f, store } = setup()
    const before = f.raw('lists', 'b1')
    for (const attempt of [
      () => store.patchAgendaItem('ana', 'b1', { kind: 'done', value: true }),
      () => store.deleteAgendaItem('ana', 'b1'),
      () => store.patchAgendaItem('ana', 'nope', { kind: 'done', value: true }),
      () => store.deleteAgendaItem('ana', 'nope'),
    ]) {
      const err = await attempt().catch((e: unknown) => e)
      expect(err).toBeInstanceOf(RuleError)
      expect(err).toMatchObject({ status: 404, message: 'not found' })
    }
    expect(f.raw('lists', 'b1')).toEqual(before)
  })

  it('checks off with a stamp and puts it back', async () => {
    const { f, store } = setup()
    const done = await store.patchAgendaItem('ana', 'a1', { kind: 'done', value: true })
    expect(done.done).toBe(true)
    expect(f.raw('lists', 'a1')).toMatchObject({ done: true, doneAt: done.doneAt })
    await store.patchAgendaItem('ana', 'a1', { kind: 'done', value: false })
    expect(f.raw('lists', 'a1')).toMatchObject({ done: false, doneAt: null })
  })

  it('deletes its own and clears only its own checked-off items', async () => {
    const { f, store } = setup()
    await store.deleteAgendaItem('ana', 'a2')
    expect(f.raw('lists', 'a2')).toBeUndefined()
    await store.patchAgendaItem('ben', 'b1', { kind: 'done', value: true })
    expect(await store.clearDoneAgenda('ana')).toBe(1)
    expect(Object.keys(f.all('lists')).sort()).toEqual(['a1', 'b1'])
  })

  it('writes back every stored field exactly, including ones it does not know', async () => {
    const { f, store } = setup()
    f.seed('lists', { x1: { ...item('ana', 'kept', '2026-09-30T07:00:00.000Z'), extra: { n: 1 } } })
    await store.patchAgendaItem('ana', 'x1', { kind: 'text', text: 'kept, edited' })
    expect(f.raw('lists', 'x1')).toEqual({ ...item('ana', 'kept, edited', '2026-09-30T07:00:00.000Z'), extra: { n: 1 } })
  })
})
