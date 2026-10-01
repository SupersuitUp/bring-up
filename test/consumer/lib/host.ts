import { getFirestore } from 'firebase-admin/firestore'
import type { BringUpHost } from '@supersuit/bring-up/server'

// Nothing here runs at import time: the build needs no credentials, only the types to line up.
export const host: BringUpHost<'a' | 'b'> = {
  member: async () => null,
  agentMember: async () => null,
  db: () => getFirestore(),
  collection: 'agenda',
}
