// What the frozen file imported from the rest of the app it came from, with the sample members every test uses.
export type Member = 'ana' | 'ben'
export class RuleError extends Error {
  constructor(message: string, public status: 400 | 403 | 404 | 409 = 403) { super(message) }
}
