/**
 * AddTodo Component
 *
 * Form to create new todos.
 * Demonstrates how Cascade automatically updates the todo list
 * without manual cache manipulation.
 */

import React, { useState, FormEvent } from 'react';
import { useCreateTodo } from '../hooks/useTodoMutations';

const AddTodo: React.FC = () => {
  const [title, setTitle] = useState('');
  const createTodo = useCreateTodo();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      return;
    }

    createTodo.mutate(
      { title: title.trim() },
      {
        onSuccess: () => {
          setTitle('');
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="add-todo-form">
      <div className="form-header">
        <h2>Add New Todo</h2>
        <p className="form-description">
          Create a todo and watch Cascade automatically update the list below!
        </p>
      </div>

      <div className="form-group">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to be done?"
          disabled={createTodo.isPending}
          className="todo-input"
          autoFocus
        />
        <button
          type="submit"
          disabled={createTodo.isPending || !title.trim()}
          className="btn-add"
        >
          {createTodo.isPending ? 'Adding...' : 'Add Todo'}
        </button>
      </div>

      {createTodo.isError && (
        <div className="error-message">
          <strong>Error:</strong> {createTodo.error.message}
        </div>
      )}

      {createTodo.isSuccess && (
        <div className="success-message">
          Todo added successfully! Notice how the list updated automatically.
        </div>
      )}
    </form>
  );
};

export default AddTodo;
