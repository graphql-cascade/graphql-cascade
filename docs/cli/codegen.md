# cascade codegen

Runs [GraphQL Code Generator](https://the-guild.dev/graphql/codegen) with the configuration in `codegen.yml`.

```bash
npx cascade codegen init   # write codegen.yml
npx cascade codegen        # generate
```

## cascade codegen init

Writes a `codegen.yml` that generates TypeScript types with the `typescript`, `typescript-operations` and `@graphql-cascade/codegen` plugins, then lists the packages to install.

| Option | Default | Description |
|--------|---------|-------------|
| `-s, --schema <path>` | `http://localhost:4000/graphql` | Schema file or endpoint |
| `-d, --documents <pattern>` | `./src/**/*.graphql` | Operation documents |
| `-o, --output <path>` | `./src/generated/graphql.ts` | Generated file |

Add `cascadeEntityFragment: true` to the plugin's `config` to generate the `CascadeEntity` fragment, the entity selection built from your queries; see the [codegen README](https://github.com/graphql-cascade/graphql-cascade/tree/main/packages/codegen#cascadeentityfragment).

## cascade codegen

| Option | Default | Description |
|--------|---------|-------------|
| `-c, --config <path>` | `codegen.yml` | Configuration file |
| `-w, --watch` | | Regenerate when files change |
