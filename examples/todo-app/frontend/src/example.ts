/**
 * Example usage of GraphQL Cascade with Apollo Client
 */

import { ApolloClient, InMemoryCache, gql } from '@apollo/client';
import { ApolloCascadeClient } from '@graphql-cascade/apollo';

// Setup Apollo Client
const client = new ApolloClient({
  uri: 'http://localhost:4000/graphql', // Your GraphQL endpoint
  cache: new InMemoryCache()
});

// Create Cascade client
const cascade = new ApolloCascadeClient(client);

// Example GraphQL mutations and queries
const CREATE_TODO = gql`
  mutation CreateTodo($input: CreateTodoInput!) {
    createTodo(input: $input) {
      success
      errors { message code }
      data {
        id
        title
        completed
        createdAt
        updatedAt
      }
      cascade {
        updated {
          __typename
          id
          operation
          entity
        }
        deleted {
          __typename
          id
          deletedAt
        }
        invalidations {
          queryName
          strategy
          scope
        }
        metadata {
          timestamp
          affectedCount
        }
      }
    }
  }
`;

const UPDATE_TODO = gql`
  mutation UpdateTodo($id: ID!, $input: UpdateTodoInput!) {
    updateTodo(id: $id, input: $input) {
      success
      errors { message code }
      data {
        id
        title
        completed
        updatedAt
      }
      cascade {
        updated {
          __typename
          id
          operation
          entity
        }
        invalidations {
          queryName
          strategy
          scope
        }
        metadata {
          timestamp
          affectedCount
        }
      }
    }
  }
`;

const DELETE_TODO = gql`
  mutation DeleteTodo($id: ID!) {
    deleteTodo(id: $id) {
      success
      errors { message code }
      data {
        id
        title
      }
      cascade {
        deleted {
          __typename
          id
          deletedAt
        }
        invalidations {
          queryName
          strategy
          scope
        }
        metadata {
          timestamp
          affectedCount
        }
      }
    }
  }
`;

const LIST_TODOS = gql`
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

// Example usage functions
export async function createTodo(title: string) {
  try {
    const result = await cascade.mutate(CREATE_TODO, {
      input: { title, completed: false }
    });

    console.log('Created todo:', result);
    return result;
  } catch (error) {
    console.error('Failed to create todo:', error);
    throw error;
  }
}

export async function updateTodo(id: string, updates: { title?: string; completed?: boolean }) {
  try {
    const result = await cascade.mutate(UPDATE_TODO, {
      id,
      input: updates
    });

    console.log('Updated todo:', result);
    return result;
  } catch (error) {
    console.error('Failed to update todo:', error);
    throw error;
  }
}

export async function deleteTodo(id: string) {
  try {
    const result = await cascade.mutate(DELETE_TODO, { id });

    console.log('Deleted todo:', result);
    return result;
  } catch (error) {
    console.error('Failed to delete todo:', error);
    throw error;
  }
}

export async function listTodos() {
  try {
    const result = await cascade.query(LIST_TODOS);

    console.log('Todos:', result.listTodos);
    return result.listTodos;
  } catch (error) {
    console.error('Failed to list todos:', error);
    throw error;
  }
}

// Example workflow
export async function exampleWorkflow() {
  console.log('🚀 Starting GraphQL Cascade example workflow...\n');

  // Create a todo
  console.log('1. Creating a todo...');
  const todo = await createTodo('Learn GraphQL Cascade');
  console.log('✅ Todo created with automatic cache updates!\n');

  // Update the todo
  console.log('2. Updating the todo...');
  await updateTodo(todo.id, { completed: true });
  console.log('✅ Todo updated with automatic cache invalidation!\n');

  // List todos (should show updated data from cache)
  console.log('3. Listing todos (from cache)...');
  const todos = await listTodos();
  console.log('✅ Todos loaded from cache!\n');

  // Delete the todo
  console.log('4. Deleting the todo...');
  await deleteTodo(todo.id);
  console.log('✅ Todo deleted with automatic cache eviction!\n');

  console.log('🎉 GraphQL Cascade workflow completed!');
  console.log('Notice how no manual cache updates were needed!');
}