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
   * Whether an error is a refusal whose message and status go back to the client. Defaults to this
   * package's own RuleError only; an app with refusals of its own passes its own check, so an error
   * is never shown just because it carries a 4xx status.
   */
  isRefusal?(err: unknown): boolean
}
