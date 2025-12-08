# CLI Tools

Command-line tools for GraphQL Cascade development.

## Installation

```bash
npm install -g @graphql-cascade/cli
```

Or use with npx (without global installation):

```bash
npx @graphql-cascade/cli init
npx @graphql-cascade/cli validate schema.graphql
npx @graphql-cascade/cli doctor
```

After global installation, use the `cascade` command directly:

## Available Commands

### init

Initialize a new Cascade-enabled project:

```bash
cascade init my-project
```

Options:
- `--client <apollo|react-query|relay|urql>` - Client library
- `--server <node|apollo-server|nestjs>` - Server platform
- `--typescript` - Use TypeScript (default: true)

**[Learn more →](/cli/init)**

### validate

Validate your schema and cascade responses:

```bash
cascade validate schema.graphql
```

Checks:
- Cascade types are correctly defined
- Mutation responses include cascade
- Entity identification patterns

**[Learn more →](/cli/validate)**

### doctor

Diagnose cascade issues:

```bash
cascade doctor
```

Analyzes:
- Missing cascade metadata
- Over-invalidation patterns
- Performance bottlenecks
- Schema compliance

**[Learn more →](/cli/doctor)**

## Global Options

- `--help` - Show help
- `--version` - Show version
- `--debug` - Enable debug logging

## Examples

Initialize a new project with Apollo Client:

```bash
cascade init my-app --client apollo --server node
cd my-app
npm install
npm start
```

Validate an existing schema:

```bash
cascade validate ./schema.graphql
```

Check for issues:

```bash
cascade doctor --endpoint http://localhost:4000/graphql
```

## Next Steps

- **[cascade init](/cli/init)** - Project initialization
- **[cascade validate](/cli/validate)** - Schema validation
- **[cascade doctor](/cli/doctor)** - Issue diagnosis
