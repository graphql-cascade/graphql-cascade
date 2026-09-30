# cascade init

Writes `cascade.config.ts`, recording the GraphQL client and schema the project uses. `cascade doctor` reads it.

```bash
npx cascade init
```

Run it in a directory with a `package.json`. It asks for the client and the schema path, proposing a schema file it finds in the project, then writes:

```typescript
import type { CascadeConfig } from "@graphql-cascade/cli";

const config: CascadeConfig = {
  client: "apollo",
  schema: "./schema.graphql",
};

export default config;
```

If the file exists, it asks before overwriting it.

## Options

| Option | Description |
|--------|-------------|
| `--client <type>` | `apollo`, `react-query`, `relay` or `urql` |
| `--schema <path>` | Path to the GraphQL schema |
| `-y, --yes` | Use the options given and defaults for the rest, without prompting; overwrites an existing file |
