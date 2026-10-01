// The look To Bring Up draws with, handed in by the app. These are live bindings: a component
// reads INK at render time, so setTheme() before the first render is all an app has to do.
// The names match the constants the list was written against, so the moved code is unchanged.
export interface BringUpTheme { serif: string; ink: string; muted: string; hairline: string; onInk: string }

export const DEFAULT_THEME: BringUpTheme = {
  serif: 'Georgia, serif', ink: '#1a1a1a', muted: '#767676', hairline: '#ececec', onInk: '#ffffff',
}

export let SERIF = DEFAULT_THEME.serif
export let INK = DEFAULT_THEME.ink
export let MUTED = DEFAULT_THEME.muted
export let HAIRLINE = DEFAULT_THEME.hairline
export let ON_INK = DEFAULT_THEME.onInk

export function setTheme(t: Partial<BringUpTheme>): void {
  if (t.serif !== undefined) SERIF = t.serif
  if (t.ink !== undefined) INK = t.ink
  if (t.muted !== undefined) MUTED = t.muted
  if (t.hairline !== undefined) HAIRLINE = t.hairline
  if (t.onInk !== undefined) ON_INK = t.onInk
}
