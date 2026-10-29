# Changelog

Version convention: below 1.0, an addition is a patch and a breaking change is a minor (npm reads `^0.1.2` as 0.1.x only, so templates take a patch on their own and hold a minor for a person).

## 0.1.4 (2026-10-29)

- The agent route takes `PATCH { id, kind, ... }`, so a person's own agent can change an item on
  that ONE person's list (for example set or clear its `detail`) without the app. The key alone
  decides whose list; an id that is not on it answers 404 `not found`, exactly as a missing one,
  and a body with no `id` answers 400.

## 0.1.3 (2026-10-29)

- An item can carry an optional `detail`: a longer note under its words (a full message, links),
  as private as the words. Trimmed, up to `AGENDA_DETAIL_MAX` (4,000) characters; blank means none,
  and an item without one stores no `detail` field, so existing records read exactly as before.
- `POST { text, detail? }` on the list and agent routes adds one; `PATCH { kind: 'detail', detail }`
  sets it, and an empty string or null clears it. New rules `validateAgendaDetail` and
  `withAgendaDetail`.
- `AgendaList` shows a Details button under an item that has one; a tap opens the note in place,
  line breaks kept and http(s) addresses clickable. `DetailText` is exported from the client entry
  for an app's own item page.

## 0.1.2 (2026-10-01)

- A host's `isRefusal` now ADDS to the package's own refusals instead of replacing them. Before,
  passing any hook turned the package's 403 `private`, 401 `unauthorized`, 404 `not found` and 400
  refusals into opaque 500s.
- A refusal answers with its own status only when that is 400-499 (403 when it has none). A refusal
  carrying any other status is logged and answers an opaque 500, instead of a success or a crash.
- `npm run check`, CI and the publish workflow refuse a date inside a comment under `src/`.
- Tests for an agent POST and a PATCH with a bad body, an `agentMember` that throws, and a refusal
  with no status.
- README and `BringUpHost` JSDoc say the hook adds to the package's refusals.

## 0.1.1 (2026-09-30)

- The first version published by GitHub Actions through npm trusted publishing, from a version
  tag. No change to the code.

## 0.1.0 (2026-09-30)

- First version: To Bring Up moved out of the app it was built in, unchanged in behaviour.
