import { describe, expect, it, vi } from 'vitest'
import { fakeFirestore } from '../../test/support/fake-firestore.js'
import { createBringUpHandlers } from './handlers.js'
import { RuleError } from '../errors.js'
import type { BringUpHost } from './host.js'

type M = 'ana' | 'ben'
function setup(signedIn: M | null = 'ana', agent: M | null = null) {
  const f = fakeFirestore()
  f.seed('lists', {
    a1: { owner: 'ana', text: 'the trip', done: false, doneAt: null, createdAt: '2026-09-30T08:00:00.000Z' },
    b1: { owner: 'ben', text: 'his', done: false, doneAt: null, createdAt: '2026-09-30T09:00:00.000Z' },
  })
  const host: BringUpHost<M> = {
    member: vi.fn(async () => signedIn),
    agentMember: vi.fn(async () => agent),
    db: () => f.db,
    collection: 'lists',
  }
  return { f, host, h: createBringUpHandlers(host) }
}
const req = (method: string, body?: unknown, raw?: string) => new Request('https://app.example/api/agenda', {
  method, headers: { 'content-type': 'application/json' }, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
})
const params = (id: string) => ({ params: Promise.resolve({ id }) })

describe('the To Bring Up API', () => {
  it('answers a stranger 403 on every route and writes nothing', async () => {
    const { f, h } = setup(null)
    const answers = [
      await h.list.GET(req('GET')), await h.list.POST(req('POST', { text: 'x' })), await h.list.DELETE(req('DELETE')),
      await h.item.PATCH(req('PATCH', { kind: 'done', value: true }), params('a1')), await h.item.DELETE(req('DELETE'), params('a1')),
    ]
    for (const res of answers) {
      expect(res.status).toBe(403)
      await expect(res.json()).resolves.toEqual({ error: 'private' })
    }
    expect(Object.keys(f.all('lists'))).toEqual(['a1', 'b1'])
  })

  it("lists the signed-in person's own items, and nobody else's", async () => {
    const { h } = setup('ana')
    const res = await h.list.GET(req('GET'))
    expect(res.status).toBe(200)
    expect((await res.json()).map((a: { id: string }) => a.id)).toEqual(['a1'])
  })

  it('adds with 201 and the item as stored', async () => {
    const { h } = setup('ben')
    const res = await h.list.POST(req('POST', { text: ' dinner ' }))
    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toMatchObject({ owner: 'ben', text: 'dinner', done: false, doneAt: null })
  })

  it('answers an unreadable body 400 bad request', async () => {
    const { h } = setup('ana')
    const res = await h.list.POST(req('POST', undefined, '{not json'))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'bad request' })
  })

  it('patches and deletes its own, 204 on delete', async () => {
    const { f, h } = setup('ana')
    expect((await h.item.PATCH(req('PATCH', { kind: 'text', text: 'the trip in May' }), params('a1'))).status).toBe(200)
    expect(f.raw('lists', 'a1')).toMatchObject({ text: 'the trip in May' })
    const del = await h.item.DELETE(req('DELETE'), params('a1'))
    expect(del.status).toBe(204)
    expect(f.raw('lists', 'a1')).toBeUndefined()
  })

  it("answers someone else's item 404 not found", async () => {
    const { h } = setup('ana')
    const res = await h.item.PATCH(req('PATCH', { kind: 'done', value: true }), params('b1'))
    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({ error: 'not found' })
  })

  it('clears what was checked off', async () => {
    const { h } = setup('ana')
    await h.item.PATCH(req('PATCH', { kind: 'done', value: true }), params('a1'))
    await expect((await h.list.DELETE(req('DELETE'))).json()).resolves.toEqual({ cleared: 1 })
  })

  it('logs and hides an unexpected failure as a plain 500', async () => {
    const { host } = setup('ana')
    const h = createBringUpHandlers({ ...host, db: () => { throw new Error('credentials missing') } })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await h.list.GET(req('GET'))
    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: 'something went wrong' })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it("passes the host's own refusal through with its words and status, when the host says it is one", async () => {
    const { host } = setup('ana')
    class HostError extends Error { constructor(m: string, public status: number) { super(m) } }
    const h = createBringUpHandlers({
      ...host,
      member: async () => { throw new HostError('session expired', 401) },
      isRefusal: (e) => e instanceof HostError,
    })
    const res = await h.list.GET(req('GET'))
    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: 'session expired' })
  })

  it('with no hook, an error that merely carries a 4xx status is not shown to the client', async () => {
    const { host } = setup('ana')
    class HostError extends Error { constructor(m: string, public status: number) { super(m) } }
    const h = createBringUpHandlers({ ...host, member: async () => { throw new HostError('session expired', 401) } })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await h.list.GET(req('GET'))
    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: 'something went wrong' })
    spy.mockRestore()
  })

  it("shows the package's own RuleError with no hook", async () => {
    const { host } = setup('ana')
    const h = createBringUpHandlers({ ...host, member: async () => { throw new RuleError('nope', 409) } })
    const res = await h.list.GET(req('GET'))
    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toEqual({ error: 'nope' })
  })
})

describe("the agent's entry point", () => {
  it('refuses a request without a valid agent key, 401, and writes nothing', async () => {
    const { f, h } = setup('ana', null)
    for (const res of [await h.agent.GET(req('GET')), await h.agent.POST(req('POST', { text: 'x' }))]) {
      expect(res.status).toBe(401)
      await expect(res.json()).resolves.toEqual({ error: 'unauthorized' })
    }
    expect(Object.keys(f.all('lists'))).toEqual(['a1', 'b1'])
  })

  it("adds to the list of the person the key acts as, whatever the body names", async () => {
    const { f, h } = setup(null, 'ben')
    const res = await h.agent.POST(req('POST', { text: 'the pricing question', owner: 'ana' }))
    expect(res.status).toBe(201)
    const added = await res.json()
    expect(f.raw('lists', added.id)).toMatchObject({ owner: 'ben', text: 'the pricing question' })
  })

  it('reads back only that person\'s list', async () => {
    const { h } = setup(null, 'ben')
    expect((await (await h.agent.GET(req('GET'))).json()).map((a: { id: string }) => a.id)).toEqual(['b1'])
  })
})
