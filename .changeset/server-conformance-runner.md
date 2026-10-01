---
"@graphql-cascade/conformance": minor
"@graphql-cascade/server": patch
---

The server conformance cases run against real servers, and `@graphql-cascade/server` passes them.

- `@graphql-cascade/conformance`: `runServerCases(target)` runs the server and transport cases against a server implementing the conformance domain, given `setup(state, limits)` and `execute(operation, variables)`; `httpTarget(endpoint, { setup })` builds a target for a server reached over HTTP. Besides each case's expectations, every cascade is checked for its shape (REQ-010), unique entries (REQ-005), no entity both updated and deleted (REQ-003), and type invalidations whenever it is truncated (REQ-050).
- `@graphql-cascade/server`: an entity tracked again keeps its latest state, so a cascade covering several mutation fields shows an entity as the last field left it (REQ-040); a created entity stays `CREATED`. Entities met again through relationships don't replace a tracked entity.
