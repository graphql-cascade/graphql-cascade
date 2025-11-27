/**
 * React Query hooks for Todo queries
 */

import { useQuery } from '@tanstack/react-query';
import { graphqlRequest } from '../api/client';
import { Todo } from '../types';

interface ListTodosResponse {
  listTodos: Todo[];
}

interface GetTodoResponse {
  getTodo: Todo;
}

const LIST_TODOS_QUERY = `
  query ListTodos {
    listTodos {
      id
      title
      completed
      createdAt
      updatedAt
    }
  }
`;

const GET_TODO_QUERY = `
  query GetTodo($id: ID!) {
    getTodo(id: $id) {
      id
      title
      completed
      createdAt
      updatedAt
    }
  }
`;

/**
 * Hook to fetch all todos
 *
 * This query will automatically refetch when mutations occur
 * thanks to Cascade invalidations - no manual cache management needed!
 */
export function useTodos() {
  return useQuery({
    queryKey: ['todos'],
    queryFn: async () => {
      const data = await graphqlRequest<ListTodosResponse>(LIST_TODOS_QUERY);
      return data.listTodos;
    },
  });
}

/**
 * Hook to fetch a single todo by ID
 *
 * Cascade will automatically update this query when the todo
 * is modified through mutations.
 */
export function useTodo(id: string) {
  return useQuery({
    queryKey: ['todo', id],
    queryFn: async () => {
      const data = await graphqlRequest<GetTodoResponse>(GET_TODO_QUERY, { id });
      return data.getTodo;
    },
    enabled: !!id,
  });
}
