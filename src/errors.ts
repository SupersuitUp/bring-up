export type RuleStatus = 400 | 401 | 403 | 404 | 409

// A refusal a person can be told about: its message is written for a reader and goes back to the
// client word for word, with its status.
export class RuleError extends Error {
  constructor(message: string, public status: RuleStatus = 403) {
    super(message)
  }
}

const STATUSES: readonly number[] = [400, 401, 403, 404, 409]

// The host app's own refusals (its sign-in, its upload pipeline, its transcriber) are a different
// class from this package's RuleError, so they are recognised by shape: an Error carrying one of
// these statuses. That keeps their words reaching the phone exactly as they did inside the app,
// which a client may depend on (Us's snap upload retries on the precise words of a refusal).
export function isRuleError(err: unknown): err is Error & { status: RuleStatus } {
  return err instanceof Error && STATUSES.includes((err as { status?: unknown }).status as number)
}
