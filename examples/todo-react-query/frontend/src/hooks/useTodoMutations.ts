/**
 * React Query hooks for Todo mutations with GraphQL Cascade
 *
 * Notice how these mutation hooks DON'T need onSuccess callbacks
 * to manually update the cache - Cascade handles it all automatically!
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { graphqlRequest } from '../api/client';
import { Todo, CreateTodoInput, UpdateTodoInput } from '../types';

interface CreateTodoResponse {
  createTodo: {
    success: boolean;
    data: Todo;
  };
}

interface UpdateTodoResponse {
  updateTodo: {
    success: boolean;
    data: Todo;
  };
}

interface DeleteTodoResponse {
  deleteTodo: {
    success: boolean;
    data: {
      id: string;
    };
  };
}

const CREATE_TODO_MUTATION = `
  mutation CreateTodo($input: CreateTodoInput!) {
    createTodo(input: $input) {
      success
      errors {
        message
        code
      }
      data {
        id
        title
        completed
        createdAt
        updatedAt
      }
    }
  }
`;

const UPDATE_TODO_MUTATION = `
  mutation UpdateTodo($id: ID!, $input: UpdateTodoInput!) {
    updateTodo(id: $id, input: $input) {
      success
      errors {
        message
        code
      }
      data {
        id
        title
        completed
        updatedAt
      }
    }
  }
`;

const DELETE_TODO_MUTATION = `
  mutation DeleteTodo($id: ID!) {
    deleteTodo(id: $id) {
      success
      errors {
        message
        code
      }
      data {
        id
      }
    }
  }
`;

/**
 * Hook to create a new todo
 *
 * WITH CASCADE:
 * - No need for manual cache updates
 * - Server sends cascade data that automatically invalidates listTodos query
 * - New todo appears in the list automatically
 *
 * WITHOUT CASCADE (traditional approach):
 * onSuccess: (data) => {
 *   queryClient.setQueryData(['todos'], (old) => [...old, data.createTodo.data]);
 *   queryClient.invalidateQueries(['todos']);
 * }
 */
export function useCreateTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTodoInput) => {
      const data = await graphqlRequest<CreateTodoResponse>(CREATE_TODO_MUTATION, { input });
      return data.createTodo.data;
    },
    // Cascade handles invalidation automatically!
    // No onSuccess callback needed for cache updates
  });
}

/**
 * Hook to update an existing todo
 *
 * WITH CASCADE:
 * - Server sends updated entity in cascade data
 * - All queries containing this todo are automatically updated
 * - Both the list view and detail view stay in sync
 *
 * WITHOUT CASCADE (traditional approach):
 * onSuccess: (data) => {
 *   queryClient.setQueryData(['todo', id], data.updateTodo.data);
 *   queryClient.setQueryData(['todos'], (old) =>
 *     old.map(t => t.id === id ? data.updateTodo.data : t)
 *   );
 * }
 */
export function useUpdateTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateTodoInput }) => {
      const data = await graphqlRequest<UpdateTodoResponse>(UPDATE_TODO_MUTATION, {
        id,
        input,
      });
      return data.updateTodo.data;
    },
    // Cascade handles cache updates automatically!
  });
}

/**
 * Hook to delete a todo
 *
 * WITH CASCADE:
 * - Server sends deleted entity ID in cascade data
 * - Todo is automatically removed from all queries
 * - List view updates without manual intervention
 *
 * WITHOUT CASCADE (traditional approach):
 * onSuccess: (_, id) => {
 *   queryClient.setQueryData(['todos'], (old) =>
 *     old.filter(t => t.id !== id)
 *   );
 *   queryClient.removeQueries(['todo', id]);
 * }
 */
export function useDeleteTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const data = await graphqlRequest<DeleteTodoResponse>(DELETE_TODO_MUTATION, { id });
      return data.deleteTodo.data;
    },
    // Cascade handles eviction automatically!
  });
}

/**
 * Hook to toggle a todo's completed status
 *
 * This is a convenience wrapper around useUpdateTodo
 * that demonstrates how cascade works seamlessly with derived mutations.
 */
export function useToggleTodo() {
  const updateTodo = useUpdateTodo();

  return useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      return updateTodo.mutateAsync({ id, input: { completed: !completed } });
    },
  });
}
