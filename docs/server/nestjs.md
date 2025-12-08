# NestJS Integration

First-class NestJS integration with decorators and dependency injection.

## Installation

```bash
npm install @graphql-cascade/nestjs @nestjs/graphql
```

## Module Setup

```typescript
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { CascadeModule } from '@graphql-cascade/nestjs';

@Module({
  imports: [
    GraphQLModule.forRoot({
      autoSchemaFile: true
    }),
    CascadeModule.forRoot({
      debug: true,
      maxDepth: 2
    })
  ]
})
export class AppModule {}
```

## Decorator-Based Tracking

```typescript
import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { Cascade, TrackCreated } from '@graphql-cascade/nestjs';

@Resolver()
export class TodoResolver {
  constructor(private todoService: TodoService) {}

  @Mutation(() => TodoMutationResponse)
  @TrackCreated('Todo') // Automatic tracking
  async createTodo(
    @Args('input') input: CreateTodoInput,
    @Cascade() cascade: CascadeContext
  ) {
    const todo = await this.todoService.create(input);

    return {
      todo,
      __cascade: cascade.getCascade()
    };
  }
}
```

## Manual Tracking

```typescript
@Mutation(() => TodoMutationResponse)
async updateTodo(
  @Args('id') id: string,
  @Args('input') input: UpdateTodoInput,
  @Cascade() cascade: CascadeContext
) {
  const todo = await this.todoService.update(id, input);

  // Manual tracking for complex logic
  cascade.trackUpdated('Todo', id);

  if (input.completed) {
    cascade.invalidate('Query', 'activeTodos');
  }

  return {
    todo,
    __cascade: cascade.getCascade()
  };
}
```

## Next Steps

- **[Schema Conventions](/server/schema-conventions)** - Best practices
- **[Directives](/server/directives)** - Custom cascade control
