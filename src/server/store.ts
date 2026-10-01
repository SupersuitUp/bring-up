import 'server-only'
import type { DocumentSnapshot } from 'firebase-admin/firestore'
import { RuleError } from '../errors.js'
import { applyAgendaPatch, canSeeAgendaItem, sortAgenda, validateAgendaText } from '../rules.js'
import type { AgendaItem, AgendaPatch } from '../types.js'
import type { BringUpHost } from './host.js'

// To Bring Up at the edge: read, call one rule, write. Every decision is in ../rules.ts.
export function createBringUpStore<M extends string>(host: Pick<BringUpHost<M>, 'db' | 'collection'>) {
  const items = () => host.db().collection(host.collection)
  const itemFrom = (doc: DocumentSnapshot): AgendaItem<M> => ({ id: doc.id, ...(doc.data() as Omit<AgendaItem<M>, 'id'>) })

  // Queried by owner, so another person's items never leave Firestore on this person's request.
  // A single-field equality needs no composite index; the order is applied here.
  async function listAgenda(m: M): Promise<AgendaItem<M>[]> {
    const snap = await items().where('owner', '==', m).get()
    return sortAgenda(snap.docs.map(itemFrom).filter((a) => canSeeAgendaItem(a, m)))
  }

  async function addAgendaItem(m: M, text: unknown): Promise<AgendaItem<M>> {
    const ref = items().doc()
    const data: Omit<AgendaItem<M>, 'id'> = { owner: m, text: validateAgendaText(text), done: false, doneAt: null, createdAt: new Date().toISOString() }
    await ref.set(data)
    return { id: ref.id, ...data }
  }

  async function patchAgendaItem(m: M, id: string, patch: AgendaPatch): Promise<AgendaItem<M>> {
    const db = host.db()
    const ref = items().doc(id)
    return db.runTransaction(async (tx) => {
      const doc = await tx.get(ref)
      if (!doc.exists) throw new RuleError('not found', 404)
      const updated = applyAgendaPatch(itemFrom(doc), m, patch, new Date().toISOString())
      const { id: _id, ...data } = updated
      tx.set(ref, data)
      return updated
    })
  }

  async function deleteAgendaItem(m: M, id: string): Promise<void> {
    const ref = items().doc(id)
    const doc = await ref.get()
    if (!doc.exists || !canSeeAgendaItem(itemFrom(doc), m)) throw new RuleError('not found', 404)
    await ref.delete()
  }

  // Everything this person has checked off, gone in one write.
  async function clearDoneAgenda(m: M): Promise<number> {
    const db = host.db()
    const done = (await listAgenda(m)).filter((a) => a.done)
    const batch = db.batch()
    for (const a of done) batch.delete(items().doc(a.id))
    await batch.commit()
    return done.length
  }

  return { listAgenda, addAgendaItem, patchAgendaItem, deleteAgendaItem, clearDoneAgenda }
}

export type BringUpStore<M extends string> = ReturnType<typeof createBringUpStore<M>>
