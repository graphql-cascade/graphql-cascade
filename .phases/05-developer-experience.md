# AXIS 5: Developer Experience

**Engineer Persona**: DX Engineer
**Status**: Analysis Complete
**Priority**: High (Drives adoption)

---

## Executive Summary

World-class developer experience is the difference between a technically excellent project and one developers actually adopt. This axis focuses on tooling, IDE integration, debugging capabilities, and migration assistance that makes graphql-cascade a joy to use.

---

## Current State Assessment

### Existing DX

| Component | Status | Quality |
|-----------|--------|---------|
| TypeScript types | ✅ Exists | Good |
| Documentation | ✅ Exists | Good |
| Examples | ✅ Basic | Needs expansion |
| CLI tooling | ❌ Missing | - |
| IDE plugins | ❌ Missing | - |
| DevTools | ❌ Missing | - |
| Migration tools | ❌ Missing | - |
| Playground | ❌ Missing | - |

### Developer Pain Points (Anticipated)

1. **Setup complexity** - Multiple packages to configure
2. **Debugging difficulty** - Can't see cascade operations
3. **Migration friction** - Converting existing manual code
4. **Schema validation** - No tooling to validate cascade-compatible schemas
5. **Learning curve** - Conceptually new approach

---

## Tooling Roadmap

### 1. CLI Tool (`@graphql-cascade/cli`)

```bash
# Installation
npm install -g @graphql-cascade/cli

# Commands
cascade init           # Initialize cascade in project
cascade validate       # Validate schema compatibility
cascade generate       # Generate types from schema
cascade migrate        # Migrate from manual cache code
cascade doctor         # Diagnose common issues
cascade benchmark      # Run performance benchmarks
```

#### CLI Architecture

```
packages/cli/
├── src/
│   ├── commands/
│   │   ├── init.ts          # Project initialization
│   │   ├── validate.ts      # Schema validation
│   │   ├── generate.ts      # Type generation
│   │   ├── migrate.ts       # Migration assistant
│   │   ├── doctor.ts        # Diagnostic tool
│   │   └── benchmark.ts     # Perf benchmarks
│   │
│   ├── lib/
│   │   ├── schema-analyzer.ts
│   │   ├── code-generator.ts
│   │   ├── migration-detector.ts
│   │   └── diagnostics.ts
│   │
│   └── index.ts
├── templates/
│   ├── apollo/
│   ├── react-query/
│   └── relay/
└── package.json
```

#### Command Details

**`cascade init`**
```bash
$ cascade init

? Which GraphQL client are you using?
  ❯ Apollo Client
    React Query
    Relay
    URQL
    Other

? Where is your GraphQL schema?
  > ./schema.graphql

? Where should cascade config be created?
  > ./cascade.config.ts

✓ Created cascade.config.ts
✓ Installed @graphql-cascade/apollo
✓ Updated package.json
✓ Added cascade link to Apollo client

Next steps:
  1. Review cascade.config.ts
  2. Run 'cascade validate' to check schema compatibility
  3. Check docs at https://graphql-cascade.org/docs
```

**`cascade validate`**
```bash
$ cascade validate

Analyzing schema.graphql...

✓ All types have 'id' field or @cascade(id: "...") directive
✓ Mutation responses follow cascade conventions
✓ No circular references without depth limits

⚠ Warnings:
  - Type 'Comment' has no relationships defined
  - Mutation 'bulkDeleteUsers' returns Boolean (consider returning deleted entities)

✗ Errors:
  - Type 'TempData' has no identifier field
    Add 'id: ID!' or '@cascade(id: "customId")'

Schema compatibility: 94%
```

**`cascade migrate`**
```bash
$ cascade migrate --scan ./src

Scanning for manual cache update patterns...

Found 12 cache update patterns:

1. src/mutations/createTodo.ts:45
   └─ cache.writeQuery with TODO_LIST
   └─ Suggested: Remove (cascade handles automatically)

2. src/mutations/updateUser.ts:23
   └─ cache.modify with User:123
   └─ Suggested: Remove (cascade handles automatically)

3. src/mutations/deleteTodo.ts:67
   └─ cache.evict with TODO_LIST
   └─ Suggested: Keep (explicit eviction may be intentional)

? Apply automatic migrations? (y/N)

Applied 11 migrations
Skipped 1 (manual review needed)

Run tests to verify changes: npm test
```

**`cascade doctor`**
```bash
$ cascade doctor

Running diagnostics...

✓ Cascade packages installed correctly
✓ Apollo Client version compatible (3.8.0)
✓ Schema loaded successfully
✓ Cascade link configured
✓ Types generated

⚠ Potential Issues:
  - Large cache size detected (5,234 entities)
    Consider: Increasing depth limit or using cache eviction
  - Slow network detected (avg 450ms latency)
    Consider: Enabling optimistic updates

✗ Problems:
  - Missing cascade link in Apollo Client
    Fix: Add CascadeLink to your link chain
    See: https://graphql-cascade.org/docs/apollo#setup

Health Score: 85/100
```

---

### 2. IDE Extensions

#### VS Code Extension (`vscode-graphql-cascade`)

**Features:**
- Schema validation inline
- Cascade response preview
- Code actions for common patterns
- Snippets for cascade setup
- Problems panel integration

```json
{
  "contributes": {
    "commands": [
      {
        "command": "graphql-cascade.validate",
        "title": "Validate Cascade Schema"
      },
      {
        "command": "graphql-cascade.preview",
        "title": "Preview Cascade Response"
      }
    ],
    "languages": [
      {
        "id": "graphql",
        "extensions": [".graphql", ".gql"]
      }
    ],
    "snippets": [
      {
        "language": "typescript",
        "path": "./snippets/typescript.json"
      }
    ]
  }
}
```

**Code Actions:**
```typescript
// When cursor is on mutation without cascade handling:
// 💡 Quick Fix: Add cascade mutation wrapper
// 💡 Quick Fix: Add optimistic response

// Before:
const [createTodo] = useMutation(CREATE_TODO);

// After (auto-fixed):
const [createTodo] = useCascadeMutation(CREATE_TODO, {
  optimistic: true
});
```

**Inline Diagnostics:**
```graphql
type User {
  # ⚠️ Warning: Missing 'id' field for cascade tracking
  # 💡 Quick Fix: Add 'id: ID!' field
  name: String!
  email: String!
}
```

#### IntelliJ Plugin (`intellij-graphql-cascade`)

- Same features as VS Code
- Gradle/Maven integration
- Kotlin/Java support
- Spring Boot integration

---

### 3. Browser DevTools Extension

#### Chrome Extension Architecture

```
devtools-extension/
├── src/
│   ├── panel/
│   │   ├── App.tsx           # Main panel UI
│   │   ├── Timeline.tsx      # Cascade operations timeline
│   │   ├── CacheViewer.tsx   # Cache state viewer
│   │   ├── Inspector.tsx     # Entity inspector
│   │   └── Settings.tsx      # Extension settings
│   │
│   ├── background/
│   │   ├── service-worker.ts # Background processing
│   │   └── message-handler.ts
│   │
│   ├── content/
│   │   └── injector.ts       # Page injection
│   │
│   └── hooks/
│       └── cascade-hook.ts   # Intercept cascade operations
│
├── manifest.json
└── package.json
```

**Panel Features:**

```
┌────────────────────────────────────────────────────────────────┐
│ GraphQL Cascade DevTools                              [⚙️] [↻] │
├────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│ │ Timeline │ │  Cache   │ │ Queries  │ │  Perf    │           │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ Timeline                                                       │
│ ─────────────────────────────────────────────────────────────  │
│                                                                │
│ 10:45:23.456  createTodo                                       │
│ ├─ Mutation sent                                    +0ms       │
│ ├─ Response received                               +124ms      │
│ ├─ Cascade extracted (3 entities)                  +125ms      │
│ ├─ Cache updated                                   +127ms      │
│ └─ Re-render triggered                             +131ms      │
│                                                                │
│ 10:45:24.102  updateUser                                       │
│ ├─ Optimistic update applied                        +0ms       │
│ ├─ Mutation sent                                    +1ms       │
│ ├─ Response received                               +98ms       │
│ ├─ Cascade verified (optimistic correct)           +99ms       │
│ └─ No re-render needed                             +99ms       │
│                                                                │
│ ─────────────────────────────────────────────────────────────  │
│                                                                │
│ Entity Inspector                    │ Cache Diff              │
│ ──────────────────────────────────  │ ──────────────────────  │
│ Todo:1                              │ - title: "Old title"    │
│   __typename: "Todo"                │ + title: "New title"    │
│   id: "1"                           │                         │
│   title: "New title"                │   completed: false      │
│   completed: false                  │   userId: "123"         │
│   user: User:123                    │                         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Time-Travel Debugging:**
```typescript
// DevTools API for cascade debugging
interface CascadeDevTools {
  // Get operation history
  getHistory(): CascadeOperation[];

  // Replay specific operation
  replay(operationId: string): void;

  // Snapshot cache state at point in time
  getSnapshot(timestamp: number): CacheSnapshot;

  // Compare two snapshots
  diffSnapshots(before: CacheSnapshot, after: CacheSnapshot): CacheDiff;

  // Export for bug reports
  exportDebugLog(): string;
}
```

---

### 4. GraphQL Playground / GraphiQL Integration

**Cascade Playground Extension:**

```typescript
// GraphiQL plugin
const CascadePlugin: GraphiQLPlugin = {
  title: 'Cascade',
  icon: CascadeIcon,
  content: () => (
    <CascadePanel>
      <CascadeResponse />
      <EntityTree />
      <InvalidationPreview />
    </CascadePanel>
  )
};

// Usage
<GraphiQL plugins={[CascadePlugin]} />
```

**Features:**
- Cascade response visualization
- Entity relationship graph
- Invalidation preview
- "What-if" analysis for mutations

---

### 5. Migration Tools

#### Codemod Package (`@graphql-cascade/codemod`)

```bash
# Install
npm install @graphql-cascade/codemod

# Run codemods
npx jscodeshift -t @graphql-cascade/codemod/transforms/remove-cache-updates.ts ./src
npx jscodeshift -t @graphql-cascade/codemod/transforms/add-cascade-wrapper.ts ./src
```

**Available Transforms:**

```typescript
// Transform: remove-cache-updates.ts
// Removes manual cache.writeQuery, cache.modify, cache.evict calls
// that are now handled by cascade

// Before:
const [createTodo] = useMutation(CREATE_TODO, {
  update(cache, { data }) {
    const existing = cache.readQuery({ query: GET_TODOS });
    cache.writeQuery({
      query: GET_TODOS,
      data: { todos: [...existing.todos, data.createTodo] }
    });
  }
});

// After:
const [createTodo] = useMutation(CREATE_TODO);
```

```typescript
// Transform: add-cascade-wrapper.ts
// Wraps mutations with cascade-aware hooks

// Before:
const [mutate] = useMutation(CREATE_TODO);

// After:
const [mutate] = useCascadeMutation(CREATE_TODO);
```

---

## Implementation Roadmap

### Phase 1: CLI Tool (Weeks 1-3)

#### Week 1
- [ ] Set up CLI package structure
- [ ] Implement `cascade init` command
- [ ] Implement `cascade validate` command
- [ ] Write unit tests

#### Week 2
- [ ] Implement `cascade generate` command
- [ ] Implement `cascade doctor` command
- [ ] Add configuration file support
- [ ] Write integration tests

#### Week 3
- [ ] Implement `cascade migrate` (basic)
- [ ] Add `cascade benchmark`
- [ ] Polish error messages
- [ ] Write documentation

---

### Phase 2: VS Code Extension (Weeks 4-5)

#### Week 4
- [ ] Set up VS Code extension project
- [ ] Implement schema validation
- [ ] Add inline diagnostics
- [ ] Create snippets

#### Week 5
- [ ] Add code actions
- [ ] Implement cascade preview
- [ ] Write tests
- [ ] Publish to marketplace

---

### Phase 3: Browser DevTools (Weeks 6-9)

#### Week 6-7
- [ ] Set up Chrome extension project
- [ ] Implement cascade hook injection
- [ ] Build timeline view
- [ ] Build cache viewer

#### Week 8
- [ ] Add entity inspector
- [ ] Implement cache diff
- [ ] Add time-travel debugging
- [ ] Build performance view

#### Week 9
- [ ] Polish UI/UX
- [ ] Write tests
- [ ] Firefox support
- [ ] Publish to stores

---

### Phase 4: Playground Integration (Week 10)

- [ ] Build GraphiQL plugin
- [ ] Build Apollo Studio integration
- [ ] Documentation

---

### Phase 5: Migration Tools (Weeks 11-12)

- [ ] Build codemod transforms
- [ ] Create migration guide
- [ ] Test on real codebases
- [ ] Document edge cases

---

## Package Structure

```
packages/
├── cli/                     # CLI tool
│   ├── src/commands/
│   └── package.json
│
├── vscode-extension/        # VS Code extension
│   ├── src/
│   └── package.json
│
├── devtools-extension/      # Browser DevTools
│   ├── src/
│   └── manifest.json
│
├── graphiql-plugin/         # GraphiQL plugin
│   ├── src/
│   └── package.json
│
└── codemod/                 # Migration codemods
    ├── transforms/
    └── package.json
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| CLI download | 10,000/month | npm stats |
| VS Code installs | 5,000+ | Marketplace |
| DevTools installs | 2,000+ | Chrome store |
| Setup time | <5 minutes | User studies |
| Migration success | >90% | User surveys |
| NPS score | 70+ | User surveys |

---

## Dependencies

| Dependency | Source |
|------------|--------|
| Stable API | Axes 2, 3 |
| Type definitions | Axis 3 |
| Performance data | Axis 4 |
| Documentation | Axis 6 |

---

*Axis 5 Plan v1.0 - DX Engineer Analysis*
