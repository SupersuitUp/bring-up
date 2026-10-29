// "To bring up": each person's own list of things to raise with someone when they next talk, so the
// day is not a stream of texts. It is never shared: no share switch, no activity line, no badge on
// anyone else's home, and an item that is not yours answers exactly as one that does not exist.
// `M` is the app's member key; stored records carry it in `owner`, and it is never renamed.
// `detail` is an optional longer note under the words (a full message, links), as private as the
// words; a stored record without one simply has no `detail` field.
export interface AgendaItem<M extends string = string> {
  id: string; owner: M; text: string
  detail?: string
  done: boolean; doneAt: string | null
  createdAt: string
}
// A detail patch sets the note, or clears it with an empty string or null.
export type AgendaPatch =
  | { kind: 'done'; value: boolean }
  | { kind: 'text'; text: string }
  | { kind: 'detail'; detail: string | null }
export interface AgendaSummary { open: number; next: string | null }
