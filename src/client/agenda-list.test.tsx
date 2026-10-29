import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { AgendaList } from './agenda-list.js'
import { DetailText } from './detail-text.js'
import { DEFAULT_THEME, setTheme } from './theme.js'
import type { AgendaItem } from '../types.js'

const API = '/api/us/agenda'
const item = (o: Partial<AgendaItem>): AgendaItem => ({
  id: 'a', owner: 'ana', text: 'x', done: false, doneAt: null, createdAt: '2026-09-30T09:00:00.000Z', ...o,
})

describe('AgendaList', () => {
  afterEach(() => { vi.unstubAllGlobals(); setTheme(DEFAULT_THEME) })

  it('says plainly that only this member can see it', () => {
    render(<AgendaList initial={[]} otherName="Ben" apiBase={API} />)
    expect(screen.getByText(/Only you can see this list/)).toBeTruthy()
    expect(screen.getByText(/Ben never sees it/)).toBeTruthy()
  })

  it('adds an item and shows what the server kept', async () => {
    const calls: unknown[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) })
      return Response.json(item({ id: 'n', text: 'the trip' }), { status: 201 })
    }))
    render(<AgendaList initial={[]} otherName="Ben" apiBase={API} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Something to bring up' }), { target: { value: 'the trip' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await screen.findByText('the trip')
    expect(calls).toEqual([{ url: API, body: { text: 'the trip' } }])
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('')
  })

  it('checks an item off into the talked-about section', async () => {
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(url)
      return Response.json(item({ id: 'a', text: 'dinner', done: true, doneAt: '2026-09-30T10:00:00.000Z' }))
    }))
    render(<AgendaList initial={[item({ id: 'a', text: 'dinner' })]} otherName="Ben" apiBase={API} />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'dinner' }))
    const talked = await screen.findByRole('region', { name: 'Talked about' })
    expect(within(talked).getByText('dinner')).toBeTruthy()
    expect(urls).toEqual([`${API}/a`])
  })

  it('snaps back and says so when a check-off fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'x' }, { status: 500 })))
    render(<AgendaList initial={[item({ id: 'a', text: 'dinner' })]} otherName="Ben" apiBase={API} />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'dinner' }))
    await screen.findByText('That did not save. Try again?')
    expect(screen.getByRole('checkbox', { name: 'dinner' }).getAttribute('aria-checked')).toBe('false')
  })

  it('clears everything talked about', async () => {
    const calls: { url: string; method?: string }[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method })
      return Response.json({ cleared: 1 })
    }))
    render(<AgendaList initial={[item({ id: 'a', text: 'open one' }), item({ id: 'b', text: 'old one', done: true, doneAt: '2026-09-30T10:00:00.000Z' })]} otherName="Ben" apiBase={API} />)
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    await waitFor(() => expect(screen.queryByText('old one')).toBeNull())
    expect(screen.getByText('open one')).toBeTruthy()
    expect(calls).toEqual([{ url: API, method: 'DELETE' }])
  })

  it('draws in the colours the app hands it', () => {
    setTheme({ ink: '#123456', onInk: '#fedcba' })
    render(<AgendaList initial={[]} otherName="Ben" apiBase={API} />)
    expect(screen.getByRole('button', { name: 'Add' })).toHaveStyle({ backgroundColor: '#123456', color: '#fedcba' })
  })

  it('opens and closes an item\'s detail with a tap, links clickable, and shows no button without one', () => {
    render(<AgendaList initial={[
      item({ id: 'a', text: 'the launch', detail: 'Read this first: https://example.com/a.\nThen the rest.' }),
      item({ id: 'b', text: 'plain one', createdAt: '2026-09-30T10:00:00.000Z' }),
    ]} otherName="Ben" apiBase={API} />)
    expect(screen.getAllByRole('button', { name: /Details/ })).toHaveLength(1)
    const toggle = screen.getByRole('button', { name: 'Details for the launch' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('link')).toBeNull()
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    const link = screen.getByRole('link', { name: 'https://example.com/a' })
    expect(link.getAttribute('href')).toBe('https://example.com/a')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
    fireEvent.click(toggle)
    expect(screen.queryByRole('link')).toBeNull()
  })
})

describe('DetailText', () => {
  it('links only http and https addresses, keeps trailing punctuation outside the link, and keeps line breaks', () => {
    const { container } = render(<DetailText text={'see https://a.example/x?y=1, and (https://b.example/z).\njavascript:alert(1) stays text'} />)
    const links = screen.getAllByRole('link')
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['https://a.example/x?y=1', 'https://b.example/z'])
    expect(container.textContent).toContain('javascript:alert(1) stays text')
    expect(container.firstElementChild?.className).toContain('whitespace-pre-wrap')
  })
})
