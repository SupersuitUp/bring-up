'use client'

import { AgendaList, BringUpProvider } from '@supersuit/bring-up/client'

export function List() {
  return (
    <BringUpProvider theme={{ ink: '#222222' }}>
      <AgendaList initial={[]} otherName="the other person" apiBase="/api/agenda" />
    </BringUpProvider>
  )
}
