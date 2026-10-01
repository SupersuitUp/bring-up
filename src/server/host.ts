import type { Firestore } from 'firebase-admin/firestore'

// Everything the app hands To Bring Up. The package knows how the feature works; the app says
// who the people are and where things are kept. To Bring Up never notifies anyone, by design.
export interface BringUpHost<M extends string> {
  /** Who is signed in for this request, or null for a stranger. */
  member(req?: Request): Promise<M | null>
  /** Which person an agent's key acts as, or null when the request carries no valid key. */
  agentMember(req: Request): Promise<M | null>
  /** Called on use, never at import, so building an app needs no credentials. */
  db(): Firestore
  /** The list items are kept in, for example 'agenda'. */
  collection: string
  /**
   * Which of the app's OWN errors are refusals whose message and status go back to the client. This
   * ADDS to the package's own refusals, which always reach the client whatever this returns; leave
   * it out and only the package's own are shown, so an error is never shown just because it
   * carries a 4xx status. A refusal answers with its `status` when that is 400-499 (403 when it has
   * none); any other status is treated as an internal error.
   */
  isRefusal?(err: unknown): boolean
}
