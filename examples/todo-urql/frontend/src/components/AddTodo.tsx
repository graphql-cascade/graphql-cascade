/**
 * AddTodo Component
 *
 * Form to create new todos.
 * Demonstrates how Cascade automatically updates the todo list
 * without manual cache manipulation.
 */

import React, { useState, FormEvent } from 'react';
import { useMutation } from 'urql';

const CREATE_TODO_MUTATION = `
  mutation CreateTodo($title: String!) {
    createTodo(title: $title) {
      success
      data {
        id
        title
        completed
      }
    }
  }
`;

const AddTodo: React.FC = () => {
  const [title, setTitle] = useState('');
  const [, createTodo] = useMutation(CREATE_TODO_MUTATION);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      return;
    }

    const result = await createTodo({ title: title.trim() });

    if (result.data?.createTodo?.success) {
      setTitle('');
    }
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
          className="todo-input"
          autoFocus
        />
        <button
          type="submit"
          disabled={!title.trim()}
          className="btn-add"
        >
          Add Todo
        </button>
      </div>

      <div className="success-message">
        Todo added successfully! Notice how the list updated automatically.
      </div>
    </form>
  );
};

export default AddTodo;