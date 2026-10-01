---
"@graphql-cascade/server": minor
"@graphql-cascade/client": minor
"@graphql-cascade/apollo": minor
"@graphql-cascade/relay": minor
"@graphql-cascade/react-query": minor
"@graphql-cascade/urql": minor
"@graphql-cascade/codegen": minor
---

Every package supports the current and the previous major of its peers, and CI tests both.

- New majors: `graphql` 17, React 19, Apollo Client 4, `relay-runtime` 21, `@urql/core` 6, NestJS 12, Express 5 and Apollo Server 5.
- **Breaking** ranges: React 16 and 17, `relay-runtime` 14 to 19, `@urql/core` 4 and NestJS 9 and 10 are no longer supported.
- `@graphql-cascade/apollo` works with Apollo Client 3 and 4: hooks come from `@apollo/client/react`, errors are recognized in both majors, and a failed mutation rejects with Apollo's own error type.
- `@graphql-cascade/apollo`: removed a no-op `update` option from `useCascadeMutation`'s internal call; the link classifies errors from the rest of the chain as network errors.
