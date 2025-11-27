/**
 * TodoList Component
 *
 * Displays a list of todos with automatic updates from Cascade.
 * When mutations occur, this component automatically re-renders
 * with the updated data - no manual cache management required!
 */

import React from 'react';
import { useTodos } from '../hooks/useTodos';
import TodoItem from './TodoItem';

const TodoList: React.FC = () => {
  const { data: todos, isLoading, error, isRefetching } = useTodos();

  if (isLoading) {
    return (
      <div className="todo-list-loading">
        <div className="spinner" />
        <p>Loading todos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="todo-list-error">
        <h3>Error loading todos</h3>
        <p>{error.message}</p>
      </div>
    );
  }

  if (!todos || todos.length === 0) {
    return (
      <div className="todo-list-empty">
        <p>No todos yet. Add one above to get started!</p>
      </div>
    );
  }

  return (
    <div className="todo-list">
      {isRefetching && (
        <div className="refetch-indicator">
          Syncing with server...
        </div>
      )}

      <div className="todo-stats">
        <span className="total">Total: {todos.length}</span>
        <span className="completed">
          Completed: {todos.filter(t => t.completed).length}
        </span>
        <span className="active">
          Active: {todos.filter(t => !t.completed).length}
        </span>
      </div>

      <div className="todo-items">
        {todos.map(todo => (
          <TodoItem key={todo.id} todo={todo} />
        ))}
      </div>

      <div className="cascade-info">
        <p className="info-text">
          <strong>Cascade Magic:</strong> This list updates automatically when you add,
          edit, or delete todos. No manual cache management needed!
        </p>
      </div>
    </div>
  );
};

export default TodoList;
