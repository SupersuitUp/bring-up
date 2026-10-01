'use client'

import type { ReactNode } from 'react'
import { setTheme, type BringUpTheme } from './theme.js'

// Hands To Bring Up the app's look before anything under it draws. The theme is plain strings, so
// a server component may render this directly around the list.
export function BringUpProvider({ theme, children }: { theme: Partial<BringUpTheme>; children: ReactNode }) {
  setTheme(theme)
  return <>{children}</>
}
