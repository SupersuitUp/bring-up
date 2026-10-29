'use client'

import { Fragment } from 'react'

// An item's detail as written: line breaks kept, and every http(s) address a link that opens in a
// new tab. Nothing else becomes a link, so a `javascript:` address stays plain text. Punctuation
// that closes a sentence or a bracket stays outside the link.
const URL_RE = /https?:\/\/[^\s<>"]+/g
const TRAILING = /[.,;:!?'")\]}]+$/

export function DetailText({ text, className = '', style }: { text: string; className?: string; style?: React.CSSProperties }) {
  const parts: React.ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0
    const raw = match[0]
    const url = raw.replace(TRAILING, '')
    if (start > last) parts.push(text.slice(last, start))
    parts.push(
      <a key={start} href={url} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-2">{url}</a>,
    )
    last = start + url.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return (
    <p className={`whitespace-pre-wrap break-words ${className}`.trim()} style={style}>
      {parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)}
    </p>
  )
}
