---
"@graphql-cascade/server": minor
"@graphql-cascade/client": minor
"@graphql-cascade/conformance": minor
---

Support application-specific error codes (spec 1.2): `CascadeError.domainCode` refines the standard `code`. The server adds `withDomainCode()`, and the conformance validator now checks `errors[].code` and `domainCode`.
