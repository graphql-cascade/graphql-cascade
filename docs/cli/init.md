# cascade init

Initialize a new GraphQL Cascade project.

## Usage

```bash
cascade init <project-name> [options]
```

## Options

- `--client <apollo|react-query|relay|urql>` - Choose client library (default: apollo)
- `--server <node|apollo-server|nestjs>` - Choose server platform (default: node)
- `--typescript` - Use TypeScript (default: true)
- `--example <todo|blog|ecommerce>` - Start with an example project
- `--skip-install` - Don't run npm install

## Examples

Create a project with Apollo Client and Node.js server:

```bash
cascade init my-project --client apollo --server node
```

Create a NestJS project with TypeScript:

```bash
cascade init api --server nestjs --typescript
```

Start with the todo example:

```bash
cascade init todo-app --example todo
```

## Project Structure

The CLI creates:

```
my-project/
├── client/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── client.ts
│   │   └── graphql/
│   └── package.json
├── server/
│   ├── src/
│   │   ├── schema.ts
│   │   ├── resolvers.ts
│   │   └── server.ts
│   └── package.json
└── package.json
```

## Next Steps

After initialization:

```bash
cd my-project
npm install
npm run dev
```

Then:
- **[Quick Start](/guide/quick-start)** - Build your first feature
- **[Client Guide](/clients/)** - Configure your client
- **[Server Guide](/server/)** - Set up your server
