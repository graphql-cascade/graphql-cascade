/**
 * Main App Component
 *
 * Sets up URQL with GraphQL Cascade integration.
 * All cache updates are handled automatically by Cascade!
 */

import React from 'react';
import { Provider } from 'urql';
import { client } from './urql-client';
import AddTodo from './components/AddTodo';
import TodoList from './components/TodoList';
import './App.css';

const App: React.FC = () => {
  return (
    <Provider value={client}>
      <div className="app">
        <header className="app-header">
          <h1>GraphQL Cascade + URQL</h1>
          <p className="subtitle">
            Todo App with Automatic Cache Management
          </p>
        </header>

        <main className="app-main">
          <div className="cascade-banner">
            <h3>What is GraphQL Cascade?</h3>
            <p>
              Cascade automatically manages your URQL cache when mutations occur.
              No more manual cache updates or invalidations!
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
                metadata in the response. The cascade exchange processes this
                metadata and automatically updates the URQL cache. No manual
                cache management required!
              </p>
              <p className="tech-stack">
                <strong>Tech Stack:</strong> React + TypeScript + URQL +
                GraphQL Cascade
              </p>
            </div>
          </footer>
        </main>
      </div>
    </Provider>
  );
};

export default App;