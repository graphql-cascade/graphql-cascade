/**
 * Main App Component
 *
 * Sets up React Query with GraphQL Cascade integration.
 * All cache updates are handled automatically by Cascade!
 */

import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './api/client';
import AddTodo from './components/AddTodo';
import TodoList from './components/TodoList';
import './App.css';

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="app">
        <header className="app-header">
          <h1>GraphQL Cascade + React Query</h1>
          <p className="subtitle">
            Todo App with Automatic Cache Management
          </p>
        </header>

        <main className="app-main">
          <div className="cascade-banner">
            <h3>What is GraphQL Cascade?</h3>
            <p>
              Cascade automatically manages your React Query cache when mutations occur.
              No more manual <code>queryClient.invalidateQueries()</code> or{' '}
              <code>queryClient.setQueryData()</code> calls!
            </p>
            <ul className="feature-list">
              <li>Create a todo - list updates automatically</li>
              <li>Update a todo - both list and detail views stay in sync</li>
              <li>Delete a todo - removed from all queries instantly</li>
            </ul>
          </div>

          <div className="app-content">
            <section className="add-section">
              <AddTodo />
            </section>

            <section className="list-section">
              <h2>Your Todos</h2>
              <TodoList />
            </section>
          </div>

          <footer className="app-footer">
            <div className="footer-content">
              <h4>Behind the Scenes</h4>
              <p>
                When you perform mutations, the GraphQL server includes cascade
                metadata in the response. This metadata tells React Query exactly
                what queries to invalidate and what entities to update. No manual
                cache management required!
              </p>
              <p className="tech-stack">
                <strong>Tech Stack:</strong> React + TypeScript + React Query +
                GraphQL Cascade
              </p>
            </div>
          </footer>
        </main>
      </div>

      {/* React Query Devtools - Open to see cascade in action! */}
      <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
    </QueryClientProvider>
  );
};

export default App;
