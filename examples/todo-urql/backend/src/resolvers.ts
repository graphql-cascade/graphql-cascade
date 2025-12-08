import { CascadeBuilder } from '@graphql-cascade/server';
import { getTodos, getTodo, createTodo, updateTodo, deleteTodo, toggleTodo, type Todo } from './db';

const cascadeBuilder = new CascadeBuilder();

export const resolvers = {
  Query: {
    todos: (): Todo[] => getTodos(),
    todo: (_: any, { id }: { id: string }): Todo | undefined => getTodo(id),
  },
  Mutation: {
    createTodo: (_: any, { title }: { title: string }) => {
      const todo = createTodo(title);
      return cascadeBuilder.buildSuccessResponse(todo, {
        operation: 'CREATE',
        entityType: 'Todo',
        entityId: todo.id,
      });
    },
    updateTodo: (_: any, { id, title, completed }: { id: string; title?: string; completed?: boolean }) => {
      const todo = updateTodo(id, { title, completed });
      if (!todo) {
        return cascadeBuilder.buildErrorResponse('Todo not found');
      }
      return cascadeBuilder.buildSuccessResponse(todo, {
        operation: 'UPDATE',
        entityType: 'Todo',
        entityId: id,
      });
    },
    deleteTodo: (_: any, { id }: { id: string }) => {
      const todo = getTodo(id);
      if (!todo) {
        return cascadeBuilder.buildErrorResponse('Todo not found');
      }
      const success = deleteTodo(id);
      return cascadeBuilder.buildSuccessResponse(todo, {
        operation: 'DELETE',
        entityType: 'Todo',
        entityId: id,
      });
    },
    toggleTodo: (_: any, { id }: { id: string }) => {
      const todo = toggleTodo(id);
      if (!todo) {
        return cascadeBuilder.buildErrorResponse('Todo not found');
      }
      return cascadeBuilder.buildSuccessResponse(todo, {
        operation: 'UPDATE',
        entityType: 'Todo',
        entityId: id,
      });
    },
  },
};