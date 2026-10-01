---
"@graphql-cascade/server": minor
---

**Breaking:** framework integrations have their own entry points, and the package loads without them.

`@graphql-cascade/server` failed to load in any project without `@nestjs/common` installed, because its root re-exported the NestJS integration, whose decorators come from `@nestjs/common` at runtime. The root entry now loads no integration peer; import the integrations from their entries:

```typescript
import { createCascadePlugin } from "@graphql-cascade/server/apollo";
import { cascadeMiddleware, getCascadeData } from "@graphql-cascade/server/express";
import { CascadeModule, CascadeService } from "@graphql-cascade/server/nestjs";
```

`typesVersions` maps the entries for TypeScript projects using `node10` module resolution.
