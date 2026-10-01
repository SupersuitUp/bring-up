import 'server-only'
import { RuleError, isRuleError } from '../errors.js'
import { parseAgendaPatch } from '../rules.js'
import type { BringUpHost } from './host.js'
import { handle as handleWith } from './http.js'
import { createBringUpStore, type BringUpStore } from './store.js'

type IdParams = { params: Promise<{ id: string }> }

// The route handlers an app mounts at its own addresses. There is no parameter anywhere that
// names an owner: the list is always the signed-in person's, or the agent key's person's.
export function createBringUpHandlers<M extends string>(host: BringUpHost<M>, store: BringUpStore<M> = createBringUpStore(host)) {
  const handle = (fn: () => Promise<Response>) => handleWith(fn, host.isRefusal ?? isRuleError)
  const signedIn = async (req?: Request): Promise<M> => {
    const m = await host.member(req)
    if (!m) throw new RuleError('private', 403)
    return m
  }
  const agent = async (req: Request): Promise<M> => {
    const m = await host.agentMember(req)
    if (!m) throw new RuleError('unauthorized', 401)
    return m
  }
  const add = async (m: M, req: Request) => {
    const body = (await req.json()) as { text?: unknown } | null
    return Response.json(await store.addAgendaItem(m, body?.text), { status: 201 })
  }

  return {
    list: {
      GET: (req?: Request) => handle(async () => Response.json(await store.listAgenda(await signedIn(req)))),
      POST: (req: Request) => handle(async () => add(await signedIn(req), req)),
      // Clears what this person has checked off.
      DELETE: (req?: Request) => handle(async () => Response.json({ cleared: await store.clearDoneAgenda(await signedIn(req)) })),
    },
    item: {
      PATCH: (req: Request, { params }: IdParams) => handle(async () => {
        const m = await signedIn(req)
        return Response.json(await store.patchAgendaItem(m, (await params).id, parseAgendaPatch(await req.json())))
      }),
      DELETE: (req: Request, { params }: IdParams) => handle(async () => {
        await store.deleteAgendaItem(await signedIn(req), (await params).id)
        return new Response(null, { status: 204 })
      }),
    },
    // An agent (a person's own assistant, from their desk) adds to and reads that ONE person's list.
    // Which person is decided by the key alone, so one agent can never write to another's list.
    agent: {
      GET: (req: Request) => handle(async () => Response.json(await store.listAgenda(await agent(req)))),
      POST: (req: Request) => handle(async () => add(await agent(req), req)),
    },
  }
}

export type BringUpHandlers<M extends string> = ReturnType<typeof createBringUpHandlers<M>>
