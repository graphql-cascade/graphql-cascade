# NestJS Integration

`@graphql-cascade/server` includes a NestJS module. `CascadeModule` provides `CascadeService`, a request-scoped service holding a tracker and a builder for each request.

## Installation

```bash
npm install @graphql-cascade/server @nestjs/common @nestjs/graphql
```

## Module Setup

```typescript
import { Module } from "@nestjs/common";
import { CascadeModule } from "@graphql-cascade/server";

@Module({
  imports: [
    CascadeModule.forRoot({
      maxDepth: 2,
      maxUpdatedEntities: 500,
      invalidator,
    }),
  ],
})
export class AppModule {}
```

`forRoot` accepts the tracker options (`maxDepth`, `excludeTypes`, `enableRelationshipTracking`), the builder's size limits (`maxUpdatedEntities`, `maxDeletedEntities`, `maxResponseSizeMb`, `maxInvalidations`) and an `invalidator`.

## Tracking in Resolvers

Inject `CascadeService` and use it the way you would use a tracker and a builder:

```typescript
import { Args, Mutation, Resolver } from "@nestjs/graphql";
import { CascadeService } from "@graphql-cascade/server";

@Resolver()
export class TodoResolver {
  constructor(
    private readonly todos: TodoService,
    private readonly cascade: CascadeService,
  ) {}

  @Mutation(() => UpdateTodoCascade)
  async updateTodo(@Args("id") id: string, @Args("input") input: UpdateTodoInput) {
    this.cascade.startTransaction();

    const todo = await this.todos.update(id, input);
    this.cascade.trackUpdate(
      { __typename: "Todo", ...todo },
      { updatedFields: Object.keys(input) },
    );

    return this.cascade.buildResponse(todo);
  }

  @Mutation(() => DeleteTodoCascade)
  async deleteTodo(@Args("id") id: string) {
    this.cascade.startTransaction();
    await this.todos.delete(id);
    this.cascade.trackDelete("Todo", id);
    return this.cascade.buildResponse(null);
  }
}
```

`UpdateTodoCascade` and `DeleteTodoCascade` are your payload types implementing `CascadeResponse`; see [Schema Conventions](/server/schema-conventions).

## CascadeService

| Method | Description |
|--------|-------------|
| `startTransaction()` | Start tracking the mutation's changes |
| `trackCreate(entity)` | Record a created entity |
| `trackUpdate(entity, { updatedFields? })` | Record an updated entity |
| `trackDelete(typename, id)` | Record a deleted entity |
| `buildResponse(data, success?, errors?)` | Build the payload and end the transaction |
| `buildErrorResponse(errors, data?)` | Build a failed payload with an empty cascade |
| `getTracker()`, `getBuilder()` | The underlying `CascadeTracker` and `CascadeBuilder` |

With an async `entityFilter`, build through the builder so the filter is awaited: `await this.cascade.getBuilder().buildResponseAsync(todo)`.

## Next Steps

- **[Node.js](/server/node)**: tracking in depth
- **[Schema Conventions](/server/schema-conventions)**: payload types
