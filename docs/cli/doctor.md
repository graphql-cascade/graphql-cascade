# cascade doctor

Checks the current project's setup and prints what passed, warnings, errors, and a health score.

```bash
npx cascade doctor
```

It checks for:

- a `package.json`, and Cascade packages among its dependencies;
- installed `node_modules`;
- a configuration file (`cascade.config.ts`, `cascade.config.js`, `graphql.config.js` or `.graphqlrc`);
- a GraphQL schema file;
- TypeScript, 4.7 or later recommended;
- `graphql` 16 or later.

The command exits with a non-zero status when a check fails.
