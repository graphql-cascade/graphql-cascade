# CLI

`@graphql-cascade/cli` provides the `cascade` command.

```bash
npm install -D @graphql-cascade/cli
npx cascade --help
```

| Command | Does |
|---------|------|
| [`cascade init`](/cli/init) | Writes `cascade.config.ts` for your client and schema |
| [`cascade validate <schema>`](/cli/validate) | Checks a schema file for problems that break cache updates |
| [`cascade doctor`](/cli/doctor) | Checks the project's setup: packages, configuration, schema, versions |
| [`cascade codegen`](/cli/codegen) | Runs GraphQL Code Generator with the Cascade plugin |
