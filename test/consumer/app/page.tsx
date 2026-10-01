import { agendaTile } from '@supersuit/bring-up'
import { List } from './list'

export const dynamic = 'force-dynamic'

// A server component using the plain entry, rendering the client list beneath it.
export default function Page() {
  const tile = agendaTile([])
  return <main><p>{tile.open} waiting</p><List /></main>
}
