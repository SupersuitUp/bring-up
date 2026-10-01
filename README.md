# @supersuit/bring-up

To Bring Up: each person's own private list of things to raise the next time they talk to
someone, so the day is not a stream of texts. Nobody else can see a list, not even that it
exists: an item that is not yours answers exactly as one that does not exist. Items are checked
off as they are talked about, and a person's own agent can add to their list from the desk.

The package knows how the feature works. The app says who is signed in, which agent key acts as
which person, where items are kept, and how they look. It was extracted from a private app that
had run the feature for its two users.

## Install

```bash
npm install @supersuit/bring-up
```

Peers: `react` and `react-dom` 19, and `firebase-admin` 13 for the server entry. With Tailwind 4,
add one line to the stylesheet that imports Tailwind, so the list's classes are generated:

```css
@source "../node_modules/@supersuit/bring-up/dist";
```

## Three entry points

- `@supersuit/bring-up`: the types and every rule, pure, safe anywhere (`sortAgenda`, `agendaTile`
  for a home tile, `applyAgendaPatch`, ...).
- `@supersuit/bring-up/server`: `createBringUpStore(host)` and `createBringUpHandlers(host)`.
  Server only.
- `@supersuit/bring-up/client`: `AgendaList`, `BringUpProvider`, `setTheme`.

## The host

```ts
import type { BringUpHost } from '@supersuit/bring-up/server'

export const host: BringUpHost<'ana' | 'ben'> = {
  member: async () => /* who is signed in, or null */ null,
  agentMember: async (req) => /* the person this request's agent key acts as, or null */ null,
  db: () => getFirestore(),   // called on use, never at import
  collection: 'agenda',       // the list items are kept in
  // isRefusal: (err) => err instanceof MyAppRefusal,   // optional
}
```

### What the host is responsible for

`agentMember` is where the package hands off a security decision, and the package cannot check it
for you. The host must:

- compare the presented agent key in constant time (for example `crypto.timingSafeEqual` over
  equal-length digests), never with `===`;
- map each key to exactly one member, and never let two members share a key, because the key alone
  decides whose list an agent reads and writes;
- return `null` for a missing, malformed or unknown key.

`member` must likewise return only the person the request is authenticated as.

### `isRefusal`

By default only this package's own `RuleError` is shown to a client, with its message and status.
Every other error is logged on the server and answers an opaque 500. An app with refusals of its
own passes `isRefusal` to say which of its errors may be shown; an error is never shown merely
because it carries a 4xx status.

## Mounting the handlers

```ts
// app/api/agenda/route.ts
export const runtime = 'nodejs'
export const { GET, POST, DELETE } = createBringUpHandlers(host).list
// app/api/agenda/[id]/route.ts: export const { PATCH, DELETE } = createBringUpHandlers(host).item
// app/api/agenda/agent/route.ts: export const { GET, POST } = createBringUpHandlers(host).agent
```

`GET` lists the signed-in person's items, `POST { text }` adds one (201), and `DELETE` on the list
clears what is checked off (`{ cleared }`). On an item, `PATCH { kind: 'done', value }` or
`{ kind: 'text', text }` changes it, and `DELETE` removes it (204). The agent routes read and add
to the one list the key's person owns. A refusal answers `{ error }` with its status; a stranger
gets 403, an agent without a valid key 401.

## The screen

```tsx
<BringUpProvider theme={{ serif, ink, muted, hairline, onInk }}>
  <AgendaList initial={items} otherName="Ben" apiBase="/api/agenda" />
</BringUpProvider>
```

`initial` comes from `createBringUpStore(host).listAgenda(member)` in a server component.

## Releasing

A release is a version tag. Bump `version` (`npm version <x.y.z> --no-git-tag-version`), add the
CHANGELOG entry, commit `package.json` and `package-lock.json` together, push, then
`git tag v<x.y.z> && git push origin v<x.y.z>`. GitHub Actions tests, builds and publishes through
npm trusted publishing. Nothing is ever published from a laptop.
