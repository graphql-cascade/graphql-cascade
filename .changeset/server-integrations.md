---
"@graphql-cascade/server": minor
---

Server integrations build complete, authorized cascades.

- **Security:** an async `entityFilter` was skipped (with a warning) whenever a response was built synchronously, so entities the viewer may not see were sent. A synchronous build now throws `AsyncEntityFilterError`, and the new `CascadeBuilder.buildResponseAsync()` applies async filters.
- The Apollo Server plugin builds `extensions.cascade` with a `CascadeBuilder` (asynchronously): the cascade now has `invalidations` and `typeInvalidations`, respects size limits, covers entities past the tracker's `maxEntities`, and no longer leaks the tracker's internal `overflow` field. `CascadePluginOptions` takes builder options and an `invalidator`; the tracker options it accepted before were never used.
- `CascadeBuilder` no longer turns a tracker failure into an empty cascade, which told clients nothing changed; only a mutation that never started a transaction gets one. Building no longer serializes the tracked entities twice.
- `cascadeMiddleware` and `CascadeModule.forRoot` accept an `invalidator`; `CascadeService.trackUpdate` accepts `updatedFields`.
- The NestJS integration's tests run again; they were excluded from the Jest configuration.
