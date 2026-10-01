# Changelog

Version convention: below 1.0, an addition is a patch and a breaking change is a minor (npm reads `^0.1.2` as 0.1.x only, so templates take a patch on their own and hold a minor for a person).

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
